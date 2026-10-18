"""Validate the literal inert article examples; no API calls or tool execution.

Run with python3 tests/content-readiness/examples_test.py. Uses the saved
environment's jsonschema package, not a new application dependency.
"""

import json
from pathlib import Path
import re
import unittest

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[2]


def blocks(article, language):
    text = (ROOT / "src/content/articles" / f"{article}.md").read_text()
    return re.findall(rf"^```{language}\n(.*?)\n```", text, re.M | re.S)


class ArticleExamples(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema, cls.valid, cls.wrong_type, cls.false_fact = [
            json.loads(value) for value in blocks("structured-outputs", "json")
        ]
        cls.validator = Draft202012Validator(cls.schema)

    def test_schema_is_valid_draft_2020_12(self):
        self.assertEqual(self.schema["$schema"], Draft202012Validator.META_SCHEMA["$id"])
        Draft202012Validator.check_schema(self.schema)

    def test_literal_parsing_and_schema_contrasts(self):
        self.validator.validate(self.valid)
        errors = list(self.validator.iter_errors(self.wrong_type))
        self.assertEqual([(list(e.path), e.validator) for e in errors], [(["publication_year"], "type")])
        malformed, = blocks("structured-outputs", "text")
        with self.assertRaises(json.JSONDecodeError):
            json.loads(malformed)

    def test_factual_failure_still_passes_schema(self):
        self.validator.validate(self.false_fact)
        self.assertEqual(self.false_fact["source_id"], self.valid["source_id"])
        # Pinned arXiv v1 record gives 2024; validator cannot establish this fact.
        self.assertEqual(self.valid["publication_year"], 2024)
        self.assertNotEqual(self.false_fact["publication_year"], 2024)

    def test_contract_rejects_missing_extra_empty_and_out_of_range_values(self):
        variants = [
            {"source_id": self.valid["source_id"]},
            {**self.valid, "publish": True},
            {**self.valid, "source_id": ""},
            {**self.valid, "publication_year": 1999},
            {**self.valid, "publication_year": 2101},
            {**self.valid, "publication_year": None},
        ]
        for value in variants:
            with self.subTest(value=value):
                self.assertFalse(self.validator.is_valid(value))

    def test_generic_tool_request_and_alternative_replies_correlate(self):
        request, success, failure = [json.loads(value) for value in blocks("tool-use", "json")]
        self.assertEqual(request["call_id"], success["call_id"])
        self.assertEqual(request["call_id"], failure["call_id"])
        self.assertEqual(request["arguments"]["article_id"], success["result"]["article_id"])
        self.assertEqual(success["status"], "ok")
        self.assertTrue(success["result"]["sources"])
        self.assertNotIn("error", success)
        self.assertEqual(failure["status"], "error")
        self.assertTrue(failure["error"]["code"])
        self.assertNotIn("result", failure)


if __name__ == "__main__":
    unittest.main(verbosity=2)
