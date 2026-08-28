import assert from "node:assert/strict";
import test from "node:test";

import { FeishuError, parseFeishuDocumentUrl } from "../../api/_lib/feishu.ts";

test("parses Feishu Wiki and Docx URLs without retaining tracking queries", () => {
  assert.deepEqual(
    parseFeishuDocumentUrl("https://my.feishu.cn/wiki/VraowsK2Xihl7OkeSJBccPHHnZ4?from=from_copylink"),
    { kind: "wiki", token: "VraowsK2Xihl7OkeSJBccPHHnZ4" },
  );
  assert.deepEqual(
    parseFeishuDocumentUrl("https://example.larksuite.com/docx/AbCdEf123456"),
    { kind: "docx", token: "AbCdEf123456" },
  );
});

test("rejects lookalike hosts, plain HTTP, unsupported paths, and malformed tokens", () => {
  const invalidUrls = [
    "https://feishu.cn.evil.example/wiki/AbCdEf123456",
    "http://my.feishu.cn/wiki/AbCdEf123456",
    "https://my.feishu.cn/sheets/AbCdEf123456",
    "https://my.feishu.cn/wiki/a%2Fb",
    "not-a-url",
  ];

  for (const value of invalidUrls) {
    assert.throws(
      () => parseFeishuDocumentUrl(value),
      (error: unknown) => error instanceof FeishuError && error.code === "INVALID_FEISHU_URL",
    );
  }
});
