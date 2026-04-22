import pytest
from unittest.mock import MagicMock, patch
from clipchat import (
    CLIPCHAT_RESPONSE_FORMAT,
    MAX_CLIPCHAT_CONTEXT_TOKENS,
    MAX_CLIPCHAT_ITERATION_CHUNKS,
    _normalise_clipchat_answer,
    answer_clipchat_question,
    build_inverted_index,
    merge_overlapping_windows,
    retrieve_candidate_chunks,
)
from utils import (
    extract_video_id,
    extract_transcript_snippet,
    hms_to_seconds,
)

@pytest.mark.parametrize("url,expected", [
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/watch?v=12345", "12345"),
    ("https://youtube.com/watch?v=someIntId12", "someIntId12")
])
def test_extract_video_id(url, expected):
    assert extract_video_id(url) == expected

@pytest.mark.parametrize("hms,expected", [
    ("1:00:00", 3600),
    ("01:30", 90),
    ("45", 45),
    ("12:34:56", 45296)
])
def test_hms_to_seconds(hms, expected):
    assert hms_to_seconds(hms) == expected

def test_extract_transcript_snippet():
    transcript = [
        {"start": 10.0, "text": "hello"},
        {"start": 15.0, "text": "world"},
        {"start": 25.0, "text": "foo"}
    ]
    # window is default 15. So 15-15=0, 15+15=30.
    snippet = extract_transcript_snippet(transcript, 15.0, window=15)
    assert snippet == "hello world foo"

    # strictly bounded
    snippet = extract_transcript_snippet(transcript, 15.0, window=5)
    assert snippet == "hello world"


def test_build_inverted_index_maps_keywords_to_entry_indices():
    entries = [
        {"start": "0", "text": "Security breach affects tokens"},
        {"start": "10", "text": "Tokens must rotate after breach"},
        {"start": "20", "text": "Unrelated closing thoughts"},
    ]

    inverted_index = build_inverted_index(entries)

    assert inverted_index["security"] == [0]
    assert inverted_index["breach"] == [0, 1]
    assert inverted_index["tokens"] == [0, 1]


def test_merge_overlapping_windows_combines_adjacent_ranges():
    windows = [(0, 2), (2, 4), (7, 8), (8, 10)]
    assert merge_overlapping_windows(windows) == [(0, 4), (7, 10)]


def test_retrieve_candidate_chunks_returns_relevant_context_windows():
    entries = [
        {"start": "0", "text": "Intro and setup"},
        {"start": "10", "text": "The breach exposed credentials"},
        {"start": "20", "text": "Users should rotate secrets immediately"},
        {"start": "30", "text": "A later section covers audits"},
        {"start": "40", "text": "Final remarks"},
    ]

    inverted_index = build_inverted_index(entries)
    candidate_chunks = retrieve_candidate_chunks(
        "What happened in the breach?",
        entries,
        inverted_index,
        top_k=3,
        context_window=1,
    )

    assert len(candidate_chunks) == 1
    assert candidate_chunks[0] == entries[0:3]


def test_normalise_clipchat_answer_standardises_citations():
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

    assert _normalise_clipchat_answer(answer) == (
        "1. Growth potential matters [13].\n"
        "2. Diverse backgrounds help [61].\n"
        "3. AI momentum is strong [198].\n"
        "4. Traditional industries matter [1005] [1180].\n"
        "5. Healthcare is growing [5076].\n"
        "6. Community matters [10031].\n"
        "7. Social dynamics shift [2522].\n"
        "8. Climate tech matters [7573] [7699]."
    )


def test_normalise_clipchat_answer_removes_timestamp_label_mid_sentence():
    answer = "The main breach happened here. (Timestamp: [0:12])"
    assert _normalise_clipchat_answer(answer) == "The main breach happened here. [12]"


@patch("clipchat.openai_client.chat.completions.create")
def test_answer_clipchat_question_uses_single_call_for_small_transcript(mock_create):
    schema_response = MagicMock()
    schema_response.choices = [
        MagicMock(
            message=MagicMock(content='{"answer":"**It happens at [0:83].**"}')
        )
    ]
    mock_create.return_value = schema_response

    response = answer_clipchat_question(
        video_title="Test Video",
        video_summary=None,
        transcript=[{"start": "83", "dur": "5.0", "text": "RAG is introduced"}],
        notes=[],
        question="Where does the speaker talk about RAG?",
    )

    assert response == {"answer": "**It happens at [83].**"}
    assert mock_create.call_count == 1
    assert mock_create.call_args.kwargs["response_format"] == CLIPCHAT_RESPONSE_FORMAT


@patch("clipchat.openai_client.chat.completions.create")
def test_answer_clipchat_question_chunks_broad_long_transcript(mock_create):
    response_message = MagicMock()
    response_message.choices = [
        MagicMock(
            message=MagicMock(
                content='{"answer":"**Key takeaways:**\\n1. **Market positioning matters** [12]."}'
            )
        )
    ]

    mock_create.return_value = response_message

    oversized_text = "token " * ((MAX_CLIPCHAT_CONTEXT_TOKENS // 2) + 5)
    transcript = [
        {"start": "12", "dur": "5.0", "text": oversized_text},
        {"start": "620", "dur": "5.0", "text": oversized_text},
    ]

    response = answer_clipchat_question(
        video_title="Long Video",
        video_summary=None,
        transcript=transcript,
        notes=[],
        question="List key takeaways",
    )

    assert response == {
        "answer": "**Key takeaways:**\n1. **Market positioning matters** [12]."
    }
    assert mock_create.call_count == 1
    assert mock_create.call_args.kwargs["response_format"] == CLIPCHAT_RESPONSE_FORMAT


@patch("clipchat.MAX_CLIPCHAT_CONTEXT_TOKENS", 200)
@patch("clipchat.CLIPCHAT_CHUNK_CHAR_BUDGET", 60)
@patch("clipchat.CLIPCHAT_CHUNK_OVERLAP_ENTRIES", 0)
@patch("clipchat.openai_client.chat.completions.create")
def test_answer_clipchat_question_limits_broad_chunk_iterations(mock_create):
    response_message = MagicMock()
    response_message.choices = [
        MagicMock(message=MagicMock(content='{"answer":"**Key takeaways** [12]."}'))
    ]

    mock_create.return_value = response_message

    transcript = [
        {"start": str(index * 10), "dur": "5.0", "text": f"segment-{index}-" + ("A" * 80)}
        for index in range(MAX_CLIPCHAT_ITERATION_CHUNKS + 2)
    ]

    response = answer_clipchat_question(
        video_title="Long Video",
        video_summary=None,
        transcript=transcript,
        notes=[],
        question="List key takeaways",
    )

    assert response == {"answer": "**Key takeaways** [12]."}
    assert mock_create.call_count == 1
    assert mock_create.call_args.kwargs["response_format"] == CLIPCHAT_RESPONSE_FORMAT


@patch("clipchat.openai_client.chat.completions.create")
def test_answer_clipchat_question_chunks_targeted_long_transcript(mock_create):
    response_message = MagicMock()
    response_message.choices = [
        MagicMock(
            message=MagicMock(
                content='{"answer":"**The speaker introduces RAG around [83].**"}'
            )
        )
    ]

    mock_create.return_value = response_message

    oversized_text = "token " * ((MAX_CLIPCHAT_CONTEXT_TOKENS // 2) + 5)
    transcript = [
        {"start": "83", "dur": "5.0", "text": oversized_text},
        {"start": "620", "dur": "5.0", "text": oversized_text},
    ]

    response = answer_clipchat_question(
        video_title="Long Video",
        video_summary=None,
        transcript=transcript,
        notes=[],
        question="Where does the speaker introduce RAG?",
    )

    assert response == {
        "answer": "**The speaker introduces RAG around [83].**"
    }
    assert mock_create.call_count == 1
    assert mock_create.call_args.kwargs["response_format"] == CLIPCHAT_RESPONSE_FORMAT


@patch("clipchat.MAX_CLIPCHAT_CONTEXT_TOKENS", 200)
@patch("clipchat.openai_client.chat.completions.create")
def test_answer_clipchat_question_long_transcript_uses_single_retrieved_context_call(mock_create):
    response_message = MagicMock()
    response_message.choices = [
        MagicMock(
            message=MagicMock(
                content='{"answer":"**The speaker introduces RAG at [83].**"}'
            )
        )
    ]

    mock_create.return_value = response_message

    transcript = [
        {"start": "0", "dur": "5.0", "text": "Intro segment " + ("A" * 120)},
        {"start": "83", "dur": "5.0", "text": "RAG is introduced here " + ("B" * 120)},
        {"start": "166", "dur": "5.0", "text": "More detailed explanation " + ("C" * 120)},
    ]

    response = answer_clipchat_question(
        video_title="Long Video",
        video_summary=None,
        transcript=transcript,
        notes=[],
        question="Where does the speaker introduce RAG?",
    )

    assert response == {"answer": "**The speaker introduces RAG at [83].**"}
    assert mock_create.call_count == 1
    assert mock_create.call_args.kwargs["response_format"] == CLIPCHAT_RESPONSE_FORMAT


@patch("clipchat.MAX_CLIPCHAT_CONTEXT_TOKENS", 200)
@patch("clipchat.CLIPCHAT_CHUNK_CHAR_BUDGET", 60)
@patch("clipchat.CLIPCHAT_CHUNK_OVERLAP_ENTRIES", 0)
@patch("clipchat.openai_client.chat.completions.create")
def test_answer_clipchat_question_limits_targeted_chunk_iterations(mock_create):
    response_message = MagicMock()
    response_message.choices = [
        MagicMock(
            message=MagicMock(
                content='{"answer":"**The speaker introduces RAG around [83].**"}'
            )
        )
    ]

    mock_create.return_value = response_message

    transcript = [
        {"start": str(index * 10), "dur": "5.0", "text": f"segment-{index}-" + ("B" * 80)}
        for index in range(MAX_CLIPCHAT_ITERATION_CHUNKS + 3)
    ]

    response = answer_clipchat_question(
        video_title="Long Video",
        video_summary=None,
        transcript=transcript,
        notes=[],
        question="Where does the speaker introduce RAG?",
    )

    assert response == {
        "answer": "**The speaker introduces RAG around [83].**"
    }
    assert mock_create.call_count == 1
    assert mock_create.call_args.kwargs["response_format"] == CLIPCHAT_RESPONSE_FORMAT
