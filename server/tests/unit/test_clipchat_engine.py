import json

import pytest
from support.fakes import FakeLLM

from clipnote.application.clipchat import engine
from clipnote.application.clipchat.engine import (
    answer_question,
    build_inverted_index,
    merge_overlapping_windows,
    retrieve_candidate_chunks,
)
from clipnote.constants import (
    CLIPCHAT_RESPONSE_SCHEMA,
    MAX_CLIPCHAT_CONTEXT_TOKENS,
    MAX_CLIPCHAT_ITERATION_CHUNKS,
)

_normalise = engine._normalise_clipchat_answer


def test_build_inverted_index_maps_keywords_to_entry_indices() -> None:
    entries = [
        {"start": "0", "text": "Security breach affects tokens"},
        {"start": "10", "text": "Tokens must rotate after breach"},
        {"start": "20", "text": "Unrelated closing thoughts"},
    ]

    index = build_inverted_index(entries)

    assert index["security"] == [0]
    assert index["breach"] == [0, 1]
    assert index["tokens"] == [0, 1]


def test_merge_overlapping_windows_combines_adjacent_ranges() -> None:
    windows = [(0, 2), (2, 4), (7, 8), (8, 10)]
    assert merge_overlapping_windows(windows) == [(0, 4), (7, 10)]


def test_retrieve_candidate_chunks_returns_relevant_context_windows() -> None:
    entries = [
        {"start": "0", "text": "Intro and setup"},
        {"start": "10", "text": "The breach exposed credentials"},
        {"start": "20", "text": "Users should rotate secrets immediately"},
        {"start": "30", "text": "A later section covers audits"},
        {"start": "40", "text": "Final remarks"},
    ]

    chunks = retrieve_candidate_chunks(
        "What happened in the breach?",
        entries,
        build_inverted_index(entries),
        top_k=3,
        context_window=1,
    )

    assert chunks == [entries[0:3]]


def test_normalise_standardises_citations() -> None:
    answer = (
        "1. Growth potential matters (Timestamp: [0:13]).\n"
        "2. Diverse backgrounds help (timestamps: [61-131]).\n"
        "3. AI momentum is strong [198-226].\n"
        "4. Traditional industries matter [1005-1045, 1180-1252].\n"
        "5. Healthcare is growing (Timestamp: [1:24:36]).\n"
        "6. Community matters ( [2:47:11] ).\n"
        "7. Social dynamics shift [2521.599 - 2562.400].\n"
        "8. Climate tech matters Timestamp: [7573, 7699]."
    )

    assert _normalise(answer) == (
        "1. Growth potential matters [13].\n"
        "2. Diverse backgrounds help [61].\n"
        "3. AI momentum is strong [198].\n"
        "4. Traditional industries matter [1005] [1180].\n"
        "5. Healthcare is growing [5076].\n"
        "6. Community matters [10031].\n"
        "7. Social dynamics shift [2522].\n"
        "8. Climate tech matters [7573] [7699]."
    )


def test_normalise_removes_timestamp_label_mid_sentence() -> None:
    assert _normalise("The breach happened here. (Timestamp: [0:12])") == (
        "The breach happened here. [12]"
    )


def test_short_transcript_uses_one_structured_call_with_the_transcript_in_the_prompt() -> None:
    llm = FakeLLM(structured='{"answer":"**It happens at [0:83].**"}')

    response = answer_question(
        llm,
        video_title="Test Video",
        transcript=[{"start": "83", "dur": "5.0", "text": "RAG is introduced"}],
        question="Where does the speaker talk about RAG?",
    )

    assert response == {"answer": "**It happens at [83].**"}
    (call,) = llm.structured_calls
    assert call["schema"] == CLIPCHAT_RESPONSE_SCHEMA
    assert call["user"] == "Where does the speaker talk about RAG?"
    assert "RAG is introduced" in call["system"]
    assert "Test Video" in call["system"]


def test_empty_transcript_answers_without_calling_the_model() -> None:
    llm = FakeLLM()

    response = answer_question(llm, video_title="T", transcript=[], question="anything?")

    assert response == {"answer": "**I couldn't find that in the transcript.**"}
    assert llm.structured_calls == []


def test_non_json_model_output_is_used_as_the_answer() -> None:
    llm = FakeLLM(structured="plain text [0:05]")

    response = answer_question(
        llm, video_title="T", transcript=[{"start": "5", "text": "x"}], question="q"
    )

    assert response == {"answer": "plain text [5]"}


@pytest.mark.parametrize(
    "question",
    ["List key takeaways", "Where does the speaker introduce RAG?"],
)
def test_oversized_transcript_still_needs_exactly_one_call(question: str) -> None:
    llm = FakeLLM(structured='{"answer":"**Answer** [12]."}')
    oversized = "token " * ((MAX_CLIPCHAT_CONTEXT_TOKENS // 2) + 5)
    transcript = [
        {"start": "12", "dur": "5.0", "text": oversized},
        {"start": "620", "dur": "5.0", "text": oversized},
    ]

    response = answer_question(llm, video_title="Long", transcript=transcript, question=question)

    assert response == {"answer": "**Answer** [12]."}
    assert len(llm.structured_calls) == 1


def test_long_transcript_sends_retrieved_context_not_the_whole_transcript(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(engine, "MAX_CLIPCHAT_CONTEXT_TOKENS", 20)
    llm = FakeLLM(structured='{"answer":"**RAG at [83].**"}')
    transcript = [
        {"start": "0", "dur": "5.0", "text": "Intro segment " + ("A" * 120)},
        {"start": "83", "dur": "5.0", "text": "RAG is introduced here " + ("B" * 120)},
        {"start": "166", "dur": "5.0", "text": "More detailed explanation " + ("C" * 120)},
    ]

    response = answer_question(
        llm, video_title="Long", transcript=transcript, question="Where is RAG introduced?"
    )

    assert response == {"answer": "**RAG at [83].**"}
    (call,) = llm.structured_calls
    context = call["system"].split("Transcript:\n", 1)[1]
    payload = json.loads(context)
    assert payload["query"] == "Where is RAG introduced?"
    assert payload["candidate_chunks"]


def test_chunk_count_is_capped_for_very_long_transcripts(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(engine, "MAX_CLIPCHAT_CONTEXT_TOKENS", 20)
    monkeypatch.setattr(engine, "CLIPCHAT_CHUNK_CHAR_BUDGET", 60)
    monkeypatch.setattr(engine, "CLIPCHAT_CHUNK_OVERLAP_ENTRIES", 0)
    llm = FakeLLM(structured='{"answer":"**Key takeaways** [12]."}')
    transcript = [
        {"start": str(i * 10), "dur": "5.0", "text": f"segment-{i}-" + ("A" * 80)}
        for i in range(MAX_CLIPCHAT_ITERATION_CHUNKS + 3)
    ]

    answer_question(llm, video_title="Long", transcript=transcript, question="List key takeaways")

    (call,) = llm.structured_calls
    assert "candidate_chunks" in call["system"]
    payload = json.loads(call["system"].split("Transcript:\n", 1)[1])
    assert len(payload["candidate_chunks"]) <= MAX_CLIPCHAT_ITERATION_CHUNKS
