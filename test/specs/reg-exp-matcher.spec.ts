import { describe, it, expect } from 'vitest';
import { RegExpMatcher } from '@/reg-exp-matcher';

/** 全マッチを replacement で置き換えた結果を返す */
const replaceAll = (pattern: string | RegExp, str: string, replacement: string | ((matcher: RegExpExecArray) => string)): string => {
  const regExpMatcher = new RegExpMatcher(pattern);
  regExpMatcher.reset(str);
  while (regExpMatcher.find()) {
    regExpMatcher.appendReplacement(replacement);
  }
  regExpMatcher.appendTail();
  return regExpMatcher.toString();
};

describe('@/reg-exp-matcher.ts', () => {

  describe('基本動作', () => {
    it('マッチ箇所ごとに置換内容を決めて組み立てられること', () => {
      const regExpMatcher = new RegExpMatcher(/\:([^/?]+)/g);
      regExpMatcher.reset('/users/:userId/orders/:orderId');
      while (regExpMatcher.find()) {
        const match = regExpMatcher.group();
        if (match === ':userId') {
          regExpMatcher.appendReplacement('12345');
        }
        if (match === ':orderId') {
          regExpMatcher.appendReplacement('99999999');
        }
      }
      regExpMatcher.appendTail();
      expect(regExpMatcher.toString()).toBe('/users/12345/orders/99999999');
    });
    it('文字列パターンはglobalとして解釈されること', () => {
      expect(replaceAll('\\{\\{([^}]+)\\}\\}', 'Hello {{name}}, {{greeting}}', (matcher) => matcher[1].toUpperCase()))
        .toBe('Hello NAME, GREETING');
    });
    it('置換関数でキャプチャグループを参照できること', () => {
      const data: Record<string, string> = { name: 'Taro' };
      expect(replaceAll(/\{([^}]+)\}/g, '{name}:{missing}', (matcher) => data[matcher[1]] ?? ''))
        .toBe('Taro:');
    });
    it('マッチしない文字列はそのまま返ること', () => {
      expect(replaceAll(/x/g, 'abc', '-')).toBe('abc');
    });
    it('大文字小文字を無視するフラグが効くこと', () => {
      expect(replaceAll(new RegExp('ab', 'gi'), 'ab AB Ab', (matcher) => `<b>${matcher[0]}</b>`))
        .toBe('<b>ab</b> <b>AB</b> <b>Ab</b>');
    });
  });

  describe('find()', () => {
    it('マッチするたびにtrueを返し、最後にfalseを返すこと', () => {
      const regExpMatcher = new RegExpMatcher(/\d/g);
      regExpMatcher.reset('a1b2');
      expect(regExpMatcher.find()).toBe(true);
      expect(regExpMatcher.group()).toBe('1');
      expect(regExpMatcher.find()).toBe(true);
      expect(regExpMatcher.group()).toBe('2');
      expect(regExpMatcher.find()).toBe(false);
    });
    it('マッチしなくなった後はreset()するまでfalseを返し続けること', () => {
      const regExpMatcher = new RegExpMatcher(/\d/g);
      regExpMatcher.reset('a1b2');
      while (regExpMatcher.find()) {
        regExpMatcher.appendReplacement('#');
      }
      expect(regExpMatcher.find()).toBe(false);
      expect(regExpMatcher.find()).toBe(false);
      regExpMatcher.appendTail();
      expect(regExpMatcher.toString()).toBe('a#b#');

      regExpMatcher.reset('a1b2');
      expect(regExpMatcher.find()).toBe(true);
      expect(regExpMatcher.group()).toBe('1');
    });
  });

  describe('group() / toMatchResult()', () => {
    it('マッチ全体とキャプチャグループを取得できること', () => {
      const regExpMatcher = new RegExpMatcher(/(\d+)-(\d+)/g);
      regExpMatcher.reset('a 12-34 b');
      regExpMatcher.find();
      expect(regExpMatcher.group()).toBe('12-34');
      expect(regExpMatcher.group(0)).toBe('12-34');
      expect(regExpMatcher.group(1)).toBe('12');
      expect(regExpMatcher.group(2)).toBe('34');
      expect(regExpMatcher.toMatchResult()?.index).toBe(2);
    });
    it('マッチに参加しなかったグループはnullを返すこと', () => {
      const regExpMatcher = new RegExpMatcher(/(a)|(b)/g);
      regExpMatcher.reset('b');
      regExpMatcher.find();
      expect(regExpMatcher.group(1)).toBeNull();
      expect(regExpMatcher.group(2)).toBe('b');
    });
    it('空文字にマッチしたグループは空文字を返すこと', () => {
      const regExpMatcher = new RegExpMatcher(/a(x*)/g);
      regExpMatcher.reset('a');
      regExpMatcher.find();
      expect(regExpMatcher.group(1)).toBe('');
    });
    it('存在しないグループ番号はRangeErrorを投げること', () => {
      const regExpMatcher = new RegExpMatcher(/(\d)/g);
      regExpMatcher.reset('1');
      regExpMatcher.find();
      expect(() => regExpMatcher.group(2)).toThrow(RangeError);
      expect(() => regExpMatcher.group(-1)).toThrow(RangeError);
    });
    it('マッチしていない状態ではgroup()はErrorを投げ、toMatchResult()はnullを返すこと', () => {
      const regExpMatcher = new RegExpMatcher(/x/g);
      expect(() => regExpMatcher.group()).toThrow('No match available');
      expect(regExpMatcher.toMatchResult()).toBeNull();

      regExpMatcher.reset('abc');
      expect(regExpMatcher.find()).toBe(false);
      expect(() => regExpMatcher.group()).toThrow('No match available');
      expect(regExpMatcher.toMatchResult()).toBeNull();
    });
    it('名前付きグループを名前で取得できること', () => {
      const regExpMatcher = new RegExpMatcher(/(?<year>\d{4})-(?<month>\d{2})/g);
      regExpMatcher.reset('2026-10');
      regExpMatcher.find();
      expect(regExpMatcher.group('year')).toBe('2026');
      expect(regExpMatcher.group('month')).toBe('10');
      expect(regExpMatcher.group(1)).toBe('2026');
    });
    it('マッチに参加しなかった名前付きグループはnullを返すこと', () => {
      const regExpMatcher = new RegExpMatcher(/(?<a>a)|(?<b>b)/g);
      regExpMatcher.reset('b');
      regExpMatcher.find();
      expect(regExpMatcher.group('a')).toBeNull();
      expect(regExpMatcher.group('b')).toBe('b');
    });
    it('存在しないグループ名はRangeErrorを投げること', () => {
      const regExpMatcher = new RegExpMatcher(/(?<a>a)/g);
      regExpMatcher.reset('a');
      regExpMatcher.find();
      expect(() => regExpMatcher.group('x')).toThrow(RangeError);
    });
    it('名前付きグループが無いパターンで名前を指定するとRangeErrorを投げること', () => {
      const regExpMatcher = new RegExpMatcher(/(a)/g);
      regExpMatcher.reset('a');
      regExpMatcher.find();
      expect(() => regExpMatcher.group('a')).toThrow(RangeError);
    });
  });

  describe('start() / end()', () => {
    it('現在のマッチの開始位置と終了位置を返すこと', () => {
      const regExpMatcher = new RegExpMatcher(/\d+/g);
      regExpMatcher.reset('ab12cd345');
      regExpMatcher.find();
      expect(regExpMatcher.start()).toBe(2);
      expect(regExpMatcher.end()).toBe(4);
      regExpMatcher.find();
      expect(regExpMatcher.start()).toBe(6);
      expect(regExpMatcher.end()).toBe(9);
    });
    it('空文字マッチでは開始位置と終了位置が等しいこと', () => {
      const regExpMatcher = new RegExpMatcher(/x*/g);
      regExpMatcher.reset('ab');
      regExpMatcher.find();
      expect(regExpMatcher.start()).toBe(0);
      expect(regExpMatcher.end()).toBe(0);
    });
    it('マッチしていない状態ではErrorを投げること', () => {
      const regExpMatcher = new RegExpMatcher(/x/g);
      expect(() => regExpMatcher.start()).toThrow('No match available');
      expect(() => regExpMatcher.end()).toThrow('No match available');
    });
  });

  describe('replaceAll()', () => {
    it('String.prototype.replaceAll と同じ結果になること', () => {
      const regExpMatcher = new RegExpMatcher(/\d/g);
      expect(regExpMatcher.replaceAll('a1b2c3', '#')).toBe('a1b2c3'.replaceAll(/\d/g, '#'));
      expect(regExpMatcher.replaceAll('a1b2c3', (match) => `<${match[0]}>`)).toBe('a<1>b<2>c<3>');
      expect(regExpMatcher.replaceAll('abc', '#')).toBe('abc');
    });
    it('notMatchReplacer がマッチ間と末尾の両方に適用されること', () => {
      const regExpMatcher = new RegExpMatcher(/[a-z]+/g);
      expect(regExpMatcher.replaceAll('hello   world  foo  ', (match) => match[0].toUpperCase(), (gap) => (gap ? '-' : '')))
        .toBe('HELLO-WORLD-FOO-');
    });
    it('呼び出し後は走査済みになり、同じインスタンスで繰り返し呼べること', () => {
      const regExpMatcher = new RegExpMatcher(/\d/g);
      expect(regExpMatcher.replaceAll('a1', '#')).toBe('a#');
      expect(regExpMatcher.find()).toBe(false);
      expect(regExpMatcher.replaceAll('b2c3', '#')).toBe('b#c#');
    });
  });

  describe('appendReplacement()', () => {
    it('置換文字列の$や\\を解釈せずそのまま出力すること', () => {
      expect(replaceAll(/(\d)/g, 'a1', '[$1\\$&]')).toBe('a[$1\\$&]');
    });
    it('マッチしていない状態で呼び出すとErrorを投げること', () => {
      const regExpMatcher = new RegExpMatcher(/b/g);
      regExpMatcher.reset('abc');
      expect(() => regExpMatcher.appendReplacement('X')).toThrow('No match available');
      while (regExpMatcher.find()) {
        regExpMatcher.appendReplacement('B');
      }
      expect(() => regExpMatcher.appendReplacement('X')).toThrow('No match available');
    });
    it('同じマッチに対して2回呼び出すとRangeErrorを投げること', () => {
      const regExpMatcher = new RegExpMatcher(/b/g);
      regExpMatcher.reset('abc');
      regExpMatcher.find();
      regExpMatcher.appendReplacement('B');
      expect(() => regExpMatcher.appendReplacement('B')).toThrow(RangeError);
    });
    it('マッチを読み飛ばしても不一致部分として出力されること', () => {
      const regExpMatcher = new RegExpMatcher(/\d/g);
      regExpMatcher.reset('a1b2c3');
      while (regExpMatcher.find()) {
        if (regExpMatcher.group() !== '2') {
          regExpMatcher.appendReplacement('#');
        }
      }
      regExpMatcher.appendTail();
      expect(regExpMatcher.toString()).toBe('a#b2c#');
    });
  });

  describe('不一致部分・末尾の置換関数', () => {
    it('notMatchReplacer / tailReplacer が不一致部分に適用されること', () => {
      const regExpMatcher = new RegExpMatcher(/[!-~]+/g);
      regExpMatcher.reset('やまだ Taro すずき');
      while (regExpMatcher.find()) {
        regExpMatcher.appendReplacement(regExpMatcher.group(), (notMatch) => `[${notMatch}]`);
      }
      regExpMatcher.appendTail((tail) => `[${tail}]`);
      expect(regExpMatcher.toString()).toBe('[やまだ ]Taro[ すずき]');
    });
    it('置換関数が返した空文字を尊重すること', () => {
      const regExpMatcher = new RegExpMatcher(/-/g);
      regExpMatcher.reset('a-b-c');
      while (regExpMatcher.find()) {
        regExpMatcher.appendReplacement(() => '', () => '');
      }
      regExpMatcher.appendTail(() => '');
      expect(regExpMatcher.toString()).toBe('');
    });
  });

  describe('RegExpの受け付け', () => {
    it('global属性のないRegExpも受け付けること', () => {
      expect(replaceAll(/a/, 'banana', 'o')).toBe('bonono');
    });
    it('呼び出し側のRegExpのlastIndexを変更しないこと', () => {
      const pattern = /a/g;
      pattern.lastIndex = 3;
      expect(replaceAll(pattern, 'banana', 'o')).toBe('bonono');
      expect(pattern.lastIndex).toBe(3);
    });
  });

  describe('走査位置のリセット', () => {
    it('同じインスタンスでreset()を繰り返し呼べること', () => {
      const regExpMatcher = new RegExpMatcher(/\d/g);
      const results: string[] = [];
      for (const chunk of ['a1b2', 'c3', 'no digits']) {
        regExpMatcher.reset(chunk);
        while (regExpMatcher.find()) {
          regExpMatcher.appendReplacement('#');
        }
        regExpMatcher.appendTail();
        results.push(regExpMatcher.toString());
      }
      expect(results).toEqual(['a#b#', 'c#', 'no digits']);
    });
    it('走査を途中で止めても次のreset()は先頭から始まること', () => {
      const regExpMatcher = new RegExpMatcher(/\d/g);
      regExpMatcher.reset('1234');
      regExpMatcher.find();
      regExpMatcher.find();
      expect(regExpMatcher.group()).toBe('2');

      regExpMatcher.reset('5678');
      regExpMatcher.find();
      expect(regExpMatcher.group()).toBe('5');
    });
  });

  describe('空文字マッチ', () => {
    it('無限ループにならず String.prototype.replaceAll と同じ結果になること', () => {
      expect(replaceAll(/x*/g, 'abc', '-')).toBe('abc'.replaceAll(/x*/g, '-'));
      expect(replaceAll(/x*/g, 'abc', '-')).toBe('-a-b-c-');
      expect(replaceAll(/x*/g, '', '-')).toBe('-');
    });
    it('unicode属性ありではサロゲートペアを分割しないこと', () => {
      expect(replaceAll(/x*/gu, '😀a', '-')).toBe('😀a'.replaceAll(/x*/gu, '-'));
      expect(replaceAll(/x*/gu, '😀a', '-')).toBe('-😀-a-');
    });
    it('unicodeSets(v)属性ありでもサロゲートペアを分割せず無限ループにならないこと', () => {
      // tsconfigのtargetがes2022のため、v属性はリテラルで書けない
      const pattern = new RegExp('x*', 'gv');
      expect(replaceAll(pattern, '😀a', '-')).toBe('😀a'.replaceAll(pattern, '-'));
      expect(replaceAll(pattern, '😀a', '-')).toBe('-😀-a-');
    });
    it('空文字マッチと通常マッチが混在しても正しく置換されること', () => {
      expect(replaceAll(/b*/g, 'abba', '-')).toBe('abba'.replaceAll(/b*/g, '-'));
    });
  });
});
