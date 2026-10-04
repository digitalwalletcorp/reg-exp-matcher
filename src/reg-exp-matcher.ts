/**
 * 置換文字列、または現在のマッチ情報から置換文字列を返す関数
 */
export type Replacement = string | ((match: RegExpExecArray) => string);

/**
 * マッチ箇所ごとに置換内容を決めながら文字列を組み立てる。
 *
 * 例)
 * const regExpMatcher = new RegExpMatcher(/\:([^/?]+)/g);
 * regExpMatcher.reset('/users/:userId/orders/:orderId');
 * while (regExpMatcher.find()) {
 *   const match = regExpMatcher.group();
 *   if (match === ':userId') {
 *     regExpMatcher.appendReplacement('12345');
 *   }
 *   if (match === ':orderId') {
 *     regExpMatcher.appendReplacement('99999999');
 *   }
 * }
 * regExpMatcher.appendTail();
 * regExpMatcher.toString(); // '/users/12345/orders/99999999'
 *
 * マッチ箇所をすべて同じ規則で置換するだけなら replaceAll() で1回で書ける
 * new RegExpMatcher(/\{(\w+)\}/g).replaceAll('Hello {name}', (match) => values[match[1]]);
 */
export class RegExpMatcher {

  private readonly regexp: RegExp;
  private match: RegExpExecArray | null = null;
  private str = '';
  private appendPosition = 0;
  private exhausted = false;
  private buffer: string[] = [];

  /**
   * @param {string | RegExp} pattern 文字列の場合はglobal属性を付与して解釈する。RegExpの場合はglobal属性の有無を問わない
   */
  constructor(pattern: string | RegExp) {
    // 走査にはglobal属性が必要。呼び出し側のRegExpのlastIndexを汚さないよう、渡されたRegExpは使わず複製する
    this.regexp = typeof pattern === 'string'
      ? new RegExp(pattern, 'g')
      : new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  }

  /**
   * 走査対象の文字列を設定し、走査位置とバッファを先頭に戻す
   *
   * @param {string} str
   */
  public reset(str: string): void {
    this.str = str;
    this.match = null;
    this.appendPosition = 0;
    this.exhausted = false;
    this.buffer = [];
    this.regexp.lastIndex = 0;
  }

  /**
   * 次のマッチ箇所へ進める
   * これ以上マッチしなくなった後は、reset()するまでfalseを返し続ける
   *
   * @returns {boolean} マッチした場合はtrue
   */
  public find(): boolean {
    if (this.exhausted) {
      return false;
    }
    this.match = this.regexp.exec(this.str);
    if (!this.match) {
      // execは失敗するとlastIndexを0に戻し、次の呼び出しで先頭から再びマッチしてしまうため、走査済みとして止める
      this.exhausted = true;
      return false;
    }
    if (this.match[0] === '') {
      // 空文字にマッチするとlastIndexが進まず同じ位置を繰り返すため、1文字(u/v属性ありならコードポイント1つ)進める
      // v属性ではunicodeがfalseになるためflagsで判定する。サロゲートペアの途中から走査すると先頭に戻ってしまい無限ループになる
      const isUnicode = /[uv]/.test(this.regexp.flags);
      const codePoint = this.str.codePointAt(this.regexp.lastIndex);
      this.regexp.lastIndex += isUnicode && codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
    }
    return true;
  }

  /**
   * 現在のマッチ文字列を返す
   *
   * @param {number | string} [group] キャプチャグループの番号、または (?<name>...) の名前。省略時はマッチ全体
   * @returns {string | null} グループがマッチに参加しなかった場合はnull
   * @throws {Error} マッチしていない場合
   * @throws {RangeError} 存在しないグループ番号・名前を指定した場合
   */
  public group(): string;
  public group(index: number): string | null;
  public group(name: string): string | null;
  public group(group: number | string = 0): string | null {
    const match = this.currentMatch();
    if (typeof group === 'string') {
      // match.groups は名前付きグループが無いパターンでは undefined になる
      if (!match.groups || !(group in match.groups)) {
        throw new RangeError(`No group ${group}`);
      }
      return match.groups[group] ?? null;
    }
    if (group < 0 || match.length <= group) {
      throw new RangeError(`No group ${group}`);
    }
    return match[group] ?? null;
  }

  /**
   * 現在のマッチの開始位置を返す
   *
   * @returns {number}
   * @throws {Error} マッチしていない場合
   */
  public start(): number {
    return this.currentMatch().index;
  }

  /**
   * 現在のマッチの終了位置(マッチ末尾の次の位置)を返す
   *
   * @returns {number}
   * @throws {Error} マッチしていない場合
   */
  public end(): number {
    const match = this.currentMatch();
    return match.index + match[0].length;
  }

  /**
   * 現在のマッチ結果を返す
   * キャプチャグループの位置が必要な場合は d 属性付きのRegExpを渡し、戻り値の indices を参照する
   *
   * @returns {RegExpExecArray | null} マッチしていない場合はnull
   */
  public toMatchResult(): RegExpExecArray | null {
    return this.match;
  }

  /**
   * 前回の置換位置から現在のマッチ箇所までの不一致文字列と、マッチ箇所の置換文字列をバッファに追加する
   *
   * @param {Replacement} replace 置換文字列、または置換関数。置換文字列の `$1` などは解釈せずそのまま出力するため、グループを参照する場合は置換関数を渡す
   * @param {(notMatch: string) => string} [notMatchReplacer] 不一致文字列の置換関数
   * @throws {Error} マッチしていない場合
   * @throws {RangeError} 現在のマッチに対して既に呼び出している場合
   */
  public appendReplacement(replace: Replacement, notMatchReplacer?: (notMatch: string) => string): void {
    const match = this.currentMatch();
    if (match.index < this.appendPosition) {
      throw new RangeError('appendReplacement has already been called for the current match');
    }
    const notMatch = this.str.slice(this.appendPosition, match.index);
    this.buffer.push(notMatchReplacer ? notMatchReplacer(notMatch) : notMatch);
    this.buffer.push(typeof replace === 'function' ? replace(match) : replace);
    this.appendPosition = match.index + match[0].length;
  }

  /**
   * 前回の置換位置から末尾までの文字列をバッファに追加する
   *
   * @param {(tail: string) => string} [tailReplacer] 末尾文字列の置換関数
   */
  public appendTail(tailReplacer?: (tail: string) => string): void {
    const tail = this.str.slice(this.appendPosition);
    this.buffer.push(tailReplacer ? tailReplacer(tail) : tail);
  }

  /**
   * バッファに追加した文字列を連結して返す
   *
   * @returns {string}
   */
  public toString(): string {
    return this.buffer.join('');
  }

  /**
   * strの全マッチ箇所をreplaceで置き換えた文字列を返す
   * reset() → find() → appendReplacement() → appendTail() → toString() を1回で行う糖衣
   * 呼び出し後は走査済みの状態になる(続けてfind()を呼んでもfalse)
   *
   * @param {string} str 走査対象の文字列
   * @param {Replacement} replace 置換文字列、または置換関数。appendReplacement() と同じ
   * @param {(notMatch: string) => string} [notMatchReplacer] マッチしなかった区間(末尾を含む)の置換関数
   * @returns {string}
   */
  public replaceAll(str: string, replace: Replacement, notMatchReplacer?: (notMatch: string) => string): string {
    this.reset(str);
    while (this.find()) {
      this.appendReplacement(replace, notMatchReplacer);
    }
    this.appendTail(notMatchReplacer);
    return this.toString();
  }

  private currentMatch(): RegExpExecArray {
    if (!this.match) {
      throw new Error('No match available');
    }
    return this.match;
  }
}
