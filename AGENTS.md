# AGENTS.md — dev-tools-main 项目指令

> 本文件为仓库级 Agent 指令（2026-11-18 独立终审后按终审包 §5 指令建立）。
> 合并原则：仅合并核心规则，不覆盖仓库既有治理（总控板/总账/冻结项纪律不变）。

## Product writing and user care（终审包 04《文字与 UX 长期纪律》核心规则节录）

- Write for the user's task, not for internal implementation details.
- Use clear, concise, warm, plain language. Avoid AI-sounding filler, hype, blame, and vague apologies.
- Error messages must say what happened, what it means, and what the user can do next.
- Empty, loading, success, failure, timeout, and cancellation states must be understandable without developer knowledge.
- English is the default product language for the US/EU market; other languages must be deliberate, consistent localizations.
- Never make privacy/security claims that are not backed by the current data flow and tests.
- Every user-visible copy change requires rendered browser review, including mobile where relevant.
- Competitor claims must be sourced and labeled as observed, vendor claim, third-party report, or inference.

## 与本仓库既有纪律的关系

- 证据四级口径（VERIFIED/REPORTED/ESTIMATED/UNKNOWN）、LOCAL_PASS≠PRODUCTION_PASS、保留动作逐句授权、冻结项不碰——沿用总控板/任务书既定纪律，本文件不重复、不取代。
- 用户可见文案（UI/错误/引导/报告/文档）改动时，上述 writing 规则与既有证据纪律同时生效。
