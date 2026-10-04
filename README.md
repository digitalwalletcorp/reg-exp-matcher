# reg-exp-matcher

[![NPM Version](https://img.shields.io/npm/v/%40digitalwalletcorp%2Freg-exp-matcher)](https://www.npmjs.com/package/@digitalwalletcorp/reg-exp-matcher) [![License](https://img.shields.io/npm/l/%40digitalwalletcorp%2Freg-exp-matcher)](https://opensource.org/licenses/MIT) [![Build Status](https://img.shields.io/github/actions/workflow/status/digitalwalletcorp/reg-exp-matcher/ci.yml?branch=main)](https://github.com/digitalwalletcorp/reg-exp-matcher/actions) [![Test Coverage](https://img.shields.io/codecov/c/github/digitalwalletcorp/reg-exp-matcher.svg)](https://codecov.io/gh/digitalwalletcorp/reg-exp-matcher)

Replaces regular expression matches one by one, with control over each match and the text between matches.
Unlike `String.prototype.replace()`, a match can be skipped, the replacement can be decided from the match, and the unmatched text can be transformed as well.
The API follows Java's `Matcher` (`find()` / `appendReplacement()` / `appendTail()`).

#### ✨ Features

* **Per-match control**: Skip a match, choose the replacement from the match, or transform the text between matches.
* **Java `Matcher` style API**: `reset()` / `find()` / `appendReplacement()` / `appendTail()` / `toString()`, plus `replaceAll()` for the common case.
* **Match details**: `group()` by index or by name, `start()` / `end()` positions, and the raw `RegExpExecArray` via `toMatchResult()`.
* **Zero Dependencies**: No external library is required.

#### ✅ Compatibility

- ✅ **Node.js**: Fully supported on all modern Node.js versions.
- ✅ **Browsers**: Fully supported on all modern browsers that support ES2022.
- ✅ **Module formats**: CommonJS and ESM.

#### 📦 Installation

```bash
npm install @digitalwalletcorp/reg-exp-matcher
# or
yarn add @digitalwalletcorp/reg-exp-matcher
```

#### 📖 Usage

```ts
import { RegExpMatcher } from '@digitalwalletcorp/reg-exp-matcher';

const values: Record<string, string> = { name: 'Taro', count: '3' };
const matcher = new RegExpMatcher(/\{(\w+)\}/g);

matcher.replaceAll('Hello {name}, you have {count} messages.', (match) => values[match[1]] ?? '');
// 'Hello Taro, you have 3 messages.'
```

##### 📝 Types

| Type | Definition | Description |
| ---- | ---------- | ----------- |
| `Replacement` | `string \| ((match: RegExpExecArray) => string)` | A replacement string, or a function that returns one from the current match. |

##### 📚 API Reference

**`new RegExpMatcher(pattern)`**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `pattern` | `string \| RegExp` | If a `string` is passed, it is compiled with the global (`g`) flag to match all occurrences. To use other flags (such as `i` or `m`), pass a `RegExp` literal (e.g., `/pattern/gim`). |

**`replaceAll(str, replacement, notMatchReplacer?)`**

Replaces every match in `str` and returns the result.
`notMatchReplacer` is applied to the text between matches and after the last match.

```ts
// Uppercase words and normalize the delimiters between them
new RegExpMatcher(/[a-z]+/g).replaceAll('hello   world  foo', (match) => match[0].toUpperCase(), (gap) => (gap ? '-' : ''));
// 'HELLO-WORLD-FOO'
```

> Replacement strings are used literally.
> `$1` and `$&` are not expanded.
> Use a function to refer to capture groups.

**`reset(str)` / `find()`**

Use these instead of `replaceAll()` when the replacement depends on the match, or when some matches should be skipped.
`reset(str)` sets the string to scan.
`find()` advances to the next match and returns `false` when there are no more.

```ts
const matcher = new RegExpMatcher(/\d/g);
matcher.reset('a1b2c3');
while (matcher.find()) {
  if (matcher.group() !== '2') {
    matcher.appendReplacement('#'); // skipped matches are kept as they are
  }
}
matcher.appendTail();
matcher.toString(); // 'a#b2c#'
```

**`group(index?)` / `group(name)` / `start()` / `end()` / `toMatchResult()`**

Information about the current match.
`group()`, `start()` and `end()` throw an `Error` when no match is available.

| Method | Returns | Description |
| ------ | ------- | ----------- |
| `group()` | `string` | The whole match. |
| `group(index)` | `string \| null` | The capture group at `index`. `null` if the group did not participate in the match. Throws a `RangeError` for an unknown index. |
| `group(name)` | `string \| null` | The named capture group `(?<name>...)`. `null` if the group did not participate in the match. Throws a `RangeError` for an unknown name. |
| `start()` | `number` | The index where the current match starts. |
| `end()` | `number` | The index just after the current match. |
| `toMatchResult()` | `RegExpExecArray \| null` | The raw match result, or `null` when no match is available. |

```ts
const matcher = new RegExpMatcher(/(?<year>\d{4})-(?<month>\d{2})/g);
matcher.reset('from 2026-10 to 2027-03');
matcher.find();
matcher.group();        // '2026-10'
matcher.group('year');  // '2026'
matcher.start();        // 5
matcher.end();          // 12
```

> **💡 Capture Group Indices**
> * Positions of capture groups are not provided.
> * Pass a `RegExp` with the `d` flag and read `toMatchResult().indices`.

**`appendReplacement(replacement, notMatchReplacer?)` / `appendTail(tailReplacer?)` / `toString()`**

Build the result inside a `find()` loop.
`appendReplacement()` appends the text since the previous match (optionally transformed by `notMatchReplacer`) and then the replacement.
It throws a `RangeError` if called twice for the same match.
`appendTail()` appends the text after the last match (optionally transformed by `tailReplacer`).
`toString()` returns everything appended so far.

```ts
// Trim the text between HTML tags, keep the tags
const matcher = new RegExpMatcher(/<[^>]+>/g);
matcher.reset('<p>  Hello  </p> <span> World </span>');
while (matcher.find()) {
  matcher.appendReplacement(matcher.group(), (text) => text.trim());
}
matcher.appendTail((tail) => tail.trim());
matcher.toString(); // '<p>Hello</p><span>World</span>'
```

#### 📜 License

This project is licensed under the MIT License. See the [LICENSE](https://opensource.org/licenses/MIT) file for details.
