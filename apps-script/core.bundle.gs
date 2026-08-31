// 自動生成。core/ を直して npm run build で作り直す。手で編集しない。
var BracketGen = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // core/bundle-entry.js
  var bundle_entry_exports = {};
  __export(bundle_entry_exports, {
    FULL_PLACEMENT_SIZES: () => FULL_PLACEMENT_SIZES,
    MAX_TEAMS: () => MAX_TEAMS,
    MIN_TEAMS: () => MIN_TEAMS,
    SCORING: () => SCORING,
    TABS: () => TABS,
    buildSpreadsheetPayload: () => buildSpreadsheetPayload,
    buildTournament: () => buildTournament,
    countBackToBack: () => countBackToBack,
    getScoring: () => getScoring,
    warningsFor: () => warningsFor
  });

  // core/util.js
  function circled(n) {
    if (n >= 1 && n <= 20) return String.fromCodePoint(9312 + n - 1);
    if (n >= 21 && n <= 35) return String.fromCodePoint(12881 + n - 21);
    return String(n);
  }
  function teamLabel(i) {
    return String.fromCharCode(65 + i);
  }
  function isPowerOfTwo(n) {
    return Number.isInteger(n) && n > 0 && (n & n - 1) === 0;
  }
  function seedOrder(size) {
    let order = [1];
    while (order.length < size) {
      const n = order.length * 2;
      const next = [];
      for (const s of order) next.push(s, n + 1 - s);
      order = next;
    }
    return order;
  }

  // core/validate.js
  var MIN_TEAMS = 4;
  var MAX_TEAMS = 20;
  var FULL_PLACEMENT_SIZES = [4, 8, 16];
  function validateTeams(teams) {
    if (!Number.isInteger(teams)) {
      throw new Error(`teams \u306F\u6574\u6570\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044: ${teams}`);
    }
    if (teams < MIN_TEAMS || teams > MAX_TEAMS) {
      throw new Error(`teams \u306F ${MIN_TEAMS}\u301C${MAX_TEAMS} \u306E\u7BC4\u56F2\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044: ${teams}`);
    }
  }
  function validateFullPlacement(teams) {
    validateTeams(teams);
    if (!isPowerOfTwo(teams) || !FULL_PLACEMENT_SIZES.includes(teams)) {
      throw new Error(
        `\u5B8C\u5168\u9806\u4F4D\u6C7A\u5B9A\u30C8\u30FC\u30CA\u30E1\u30F3\u30C8\u306F ${FULL_PLACEMENT_SIZES.join(" / ")} \u30C1\u30FC\u30E0\u3067\u306E\u307F\u6210\u7ACB\u3057\u307E\u3059\uFF08\u6307\u5B9A: ${teams}\uFF09\u3002
\u3053\u306E\u5F62\u5F0F\u306F\u300C\u5168\u30C1\u30FC\u30E0\u304C\u540C\u3058\u8A66\u5408\u6570\u3092\u6226\u3044\u30011\u4F4D\u304B\u3089\u6700\u4E0B\u4F4D\u307E\u3067\u5168\u9806\u4F4D\u304C\u6C7A\u307E\u308B\u300D\u3053\u3068\u304C\u524D\u63D0\u3067\u3001
2\u306E\u51AA\u3067\u306A\u3044\u30C1\u30FC\u30E0\u6570\u3067\u306F\u30B7\u30FC\u30C9\u304C\u5FC5\u8981\u306B\u306A\u308A\u3001\u8A66\u5408\u6570\u304C\u4E0D\u5747\u7B49\u306B\u306A\u308A\u307E\u3059\u3002
${teams} \u30C1\u30FC\u30E0\u306A\u3089 format: single \u307E\u305F\u306F double \u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002`
      );
    }
  }
  function warningsFor({ format, teams, courts, matches, slots }) {
    const w = [];
    if (format === "full-placement" && matches >= 32) {
      w.push(
        `${teams}\u30C1\u30FC\u30E0\u306E\u5B8C\u5168\u9806\u4F4D\u6C7A\u5B9A\u306F\u5168${matches}\u8A66\u5408\u306B\u306A\u308A\u307E\u3059\u3002\u5168\u54E1\u304C\u540C\u3058\u8A66\u5408\u6570\u3092\u6226\u3046\u5F62\u5F0F\u306A\u306E\u3067\u3001\u8A66\u5408\u6570\u306F\u30C1\u30FC\u30E0\u6570\u306B\u5BFE\u3057\u3066\u6025\u306B\u5897\u3048\u307E\u3059\u3002`
      );
    }
    if (slots >= 12) {
      const hours = Math.round(slots * 25 / 60 * 10) / 10;
      w.push(
        `\u5168${slots}\u67A0\u306B\u306A\u308A\u307E\u3059\u30021\u8A66\u540820\u5206\uFF0B\u8EE2\u63DB5\u5206\u306A\u3089\u7D04${hours}\u6642\u9593\u304B\u304B\u308B\u898B\u8FBC\u307F\u3067\u3059\u3002\u534A\u65E5\u3067\u7D42\u308F\u3089\u305B\u305F\u3044\u5834\u5408\u306F\u30B3\u30FC\u30C8\u6570\u3092\u5897\u3084\u3059\u304B\u3001\u30C1\u30FC\u30E0\u6570\u304B\u5F62\u5F0F\u3092\u898B\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
      );
    }
    if (courts >= teams / 2) {
      w.push(
        `\u30B3\u30FC\u30C8${courts}\u9762\u306F\u30C1\u30FC\u30E0\u6570\uFF08${teams}\uFF09\u306B\u5BFE\u3057\u3066\u591A\u3044\u305F\u3081\u3001\u5168\u30C1\u30FC\u30E0\u304C\u540C\u6642\u306B\u52D5\u304D\u307E\u3059\u3002\u9023\u6226\u3092\u907F\u3051\u306B\u304F\u304F\u306A\u308A\u307E\u3059\u3002`
      );
    }
    return w;
  }

  // core/formats/full-placement.js
  function buildFullPlacement({ teams }) {
    validateFullPlacement(teams);
    const entrants = [];
    for (let i = 0; i < teams; i++) {
      entrants.push({ type: "team", index: i, label: teamLabel(i) });
    }
    const raw = [];
    let seq = 0;
    function build(list, rankStart, roundNo) {
      if (list.length === 1) return;
      const n = list.length;
      const created = [];
      for (let i = 0; i < n; i += 2) {
        const m = {
          seq: seq++,
          roundNo,
          rankStart,
          // この試合の勝敗が関わる順位帯の先頭
          rankSpan: n,
          // 順位帯の広さ
          left: list[i],
          right: list[i + 1]
        };
        raw.push(m);
        created.push(m);
      }
      build(created.map((m) => ({ type: "winner", of: m })), rankStart, roundNo + 1);
      build(created.map((m) => ({ type: "loser", of: m })), rankStart + n / 2, roundNo + 1);
    }
    build(entrants, 1, 1);
    const ordered = [...raw].sort(
      (a, b) => a.roundNo - b.roundNo || b.rankStart - a.rankStart || a.seq - b.seq
    );
    ordered.forEach((m, i) => {
      m.no = i + 1;
      m.id = `M${i + 1}`;
      m.label = circled(i + 1);
    });
    const resolveRef = (ref) => ref.type === "team" ? { type: "team", index: ref.index, label: ref.label } : { type: ref.type, match: ref.of.id, matchLabel: ref.of.label };
    for (const m of ordered) {
      m.leftRef = resolveRef(m.left);
      m.rightRef = resolveRef(m.right);
      m.winnerTo = null;
      m.loserTo = null;
    }
    for (const m of ordered) {
      for (const [ref, side] of [[m.left, "left"], [m.right, "right"]]) {
        if (ref.type === "winner") ref.of.winnerTo = m.id;
        if (ref.type === "loser") ref.of.loserTo = m.id;
      }
    }
    const rounds = Math.log2(teams);
    return {
      format: "full-placement",
      teams,
      teamLabels: entrants.map((e) => e.label),
      rounds,
      placements: teams,
      matches: ordered.map((m) => ({
        id: m.id,
        no: m.no,
        label: m.label,
        roundNo: m.roundNo,
        roundName: roundName(m, rounds),
        rankStart: m.rankStart,
        rankSpan: m.rankSpan,
        left: m.leftRef,
        right: m.rightRef,
        winnerTo: m.winnerTo,
        loserTo: m.loserTo,
        // 順位帯が2まで狭まった試合が、そのまま順位を確定させる
        decides: m.rankSpan === 2 ? { winner: m.rankStart, loser: m.rankStart + 1 } : null
      }))
    };
  }
  function roundName(m, rounds) {
    if (m.roundNo === 1) return "1\u56DE\u6226";
    if (m.rankSpan === 2) {
      return m.rankStart === 1 ? "\u6C7A\u52DD" : `${m.rankStart}\u4F4D\u6C7A\u5B9A\u6226`;
    }
    const band = m.roundNo === 2 ? m.rankStart === 1 ? "\uFF08\u4E0A\u5C71\uFF09" : "\uFF08\u4E0B\u5C71\uFF09" : `\uFF08${m.rankStart}\u301C${m.rankStart + m.rankSpan - 1}\u4F4D\uFF09`;
    if (m.rankSpan === 4 && m.rankStart === 1) return `\u6E96\u6C7A\u52DD${band}`;
    return `${m.roundNo}\u56DE\u6226${band}`;
  }

  // core/formats/double-elimination.js
  var BYE = { type: "bye" };
  var isBye = (r) => r.type === "bye";
  function buildDoubleElimination({ teams, bracketReset = true }) {
    var _a, _b, _c, _d;
    validateTeams(teams);
    if (teams < 4) throw new Error(`\u30C0\u30D6\u30EB\u30A8\u30EA\u30DF\u30CD\u30FC\u30B7\u30E7\u30F3\u306F4\u30C1\u30FC\u30E0\u4EE5\u4E0A\u3067\u4F7F\u3063\u3066\u304F\u3060\u3055\u3044: ${teams}`);
    const size = 2 ** Math.ceil(Math.log2(teams));
    const order = seedOrder(size);
    const raw = [];
    let seq = 0;
    const play = (left, right, meta) => {
      if (isBye(left) && isBye(right)) return { win: BYE, lose: BYE };
      if (isBye(left)) return { win: right, lose: BYE };
      if (isBye(right)) return { win: left, lose: BYE };
      const m = { ...meta, seq: seq++, left, right };
      raw.push(m);
      return { win: { type: "winner", of: m }, lose: { type: "loser", of: m } };
    };
    let cur = order.map(
      (s) => s <= teams ? { type: "team", index: s - 1, label: teamLabel(s - 1) } : BYE
    );
    const wbLosers = [];
    let wr = 1;
    const levels = [cur.slice()];
    while (cur.length > 1) {
      const next = [], losers = [];
      for (let i = 0; i < cur.length; i += 2) {
        const { win, lose } = play(cur[i], cur[i + 1], { bracket: "W", roundNo: wr });
        next.push(win);
        losers.push(lose);
      }
      wbLosers.push(losers);
      cur = next;
      levels.push(cur.slice());
      wr += 1;
    }
    const wbChampion = cur[0];
    const wbRounds = wr - 1;
    let pool = (_a = wbLosers[0]) != null ? _a : [];
    let lr = 1;
    const lbLevels = pool.length ? [{ refs: pool.slice(), kind: "drop" }] : [];
    for (let r = 1; r < wbLosers.length; r++) {
      const minor = [];
      for (let i = 0; i < pool.length; i += 2) {
        minor.push(play(pool[i], (_b = pool[i + 1]) != null ? _b : BYE, { bracket: "L", roundNo: lr }).win);
      }
      lr += 1;
      pool = minor;
      lbLevels.push({ refs: pool.slice(), kind: "minor" });
      const drop = wbLosers[r];
      const major = [];
      for (let i = 0; i < pool.length; i++) {
        major.push(play(pool[i], (_c = drop[i]) != null ? _c : BYE, { bracket: "L", roundNo: lr }).win);
      }
      lr += 1;
      pool = major;
      lbLevels.push({ refs: pool.slice(), kind: "major" });
    }
    const lbChampion = (_d = pool[0]) != null ? _d : BYE;
    const grand = play(wbChampion, lbChampion, { bracket: "F", roundNo: 1 });
    const grandMatch = raw[raw.length - 1];
    let resetMatch = null;
    if (bracketReset && grandMatch) {
      resetMatch = {
        bracket: "F",
        roundNo: 2,
        seq: seq++,
        left: { type: "winner", of: grandMatch },
        right: { type: "loser", of: grandMatch },
        conditional: true,
        // 決勝で敗者側代表（右側）が勝ったときだけ実施する
        playedIf: { match: grandMatch, side: "right" }
      };
      raw.push(resetMatch);
    }
    const depth = /* @__PURE__ */ new Map();
    const depthOf = (m) => {
      if (depth.has(m)) return depth.get(m);
      const d = 1 + Math.max(
        ...[m.left, m.right].map((r) => r.type === "team" || isBye(r) ? 0 : depthOf(r.of))
      );
      depth.set(m, d);
      return d;
    };
    raw.forEach(depthOf);
    const rank = { W: 0, L: 1, F: 2 };
    const ordered = [...raw].sort(
      (a, b) => depthOf(a) - depthOf(b) || rank[a.bracket] - rank[b.bracket] || a.seq - b.seq
    );
    const counters = { W: 0, L: 0 };
    ordered.forEach((m, i) => {
      m.id = `M${i + 1}`;
      m.no = i + 1;
      if (m.bracket === "F") {
        m.label = m.conditional ? "\u6C7A\u52DDR" : "\u6C7A\u52DD";
        m.roundName = m.conditional ? "\u6C7A\u52DD\u30EA\u30BB\u30C3\u30C8" : "\u6C7A\u52DD";
      } else {
        counters[m.bracket] += 1;
        const mark = circled(counters[m.bracket]);
        m.label = (m.bracket === "W" ? "\u8868" : "\u88CF") + mark;
        m.roundName = m.bracket === "W" ? `\u52DD\u8005\u5074 ${m.roundNo}\u56DE\u6226` : `\u6557\u8005\u5074 ${m.roundNo}\u56DE\u6226`;
      }
    });
    const resolve = (ref) => ref.type === "team" ? { type: "team", index: ref.index, label: ref.label } : { type: ref.type, match: ref.of.id, matchLabel: ref.of.label };
    for (const m of ordered) {
      m.leftRef = resolve(m.left);
      m.rightRef = resolve(m.right);
      m.winnerTo = null;
      m.loserTo = null;
    }
    for (const m of ordered) {
      for (const ref of [m.left, m.right]) {
        if (ref.type === "winner") ref.of.winnerTo = m.id;
        if (ref.type === "loser") ref.of.loserTo = m.id;
      }
    }
    const lbFinal = [...ordered].reverse().find((m) => m.bracket === "L");
    return {
      format: "double-elimination",
      teams,
      tree: {
        size,
        levels: levels.map((lv) => lv.map((r) => isBye(r) ? null : resolve(r))),
        title: "\u52DD\u8005\u5074\u30D6\u30E9\u30B1\u30C3\u30C8"
      },
      loserTree: {
        title: "\u6557\u8005\u5074\u30D6\u30E9\u30B1\u30C3\u30C8",
        levels: lbLevels.map((lv) => ({
          kind: lv.kind,
          refs: lv.refs.map((r) => isBye(r) ? null : resolve(r))
        }))
      },
      teamLabels: Array.from({ length: teams }, (_, i) => teamLabel(i)),
      rounds: wbRounds,
      placements: 3,
      bracketReset: Boolean(resetMatch),
      matches: ordered.map((m) => ({
        id: m.id,
        no: m.no,
        label: m.label,
        roundNo: m.roundNo,
        roundName: m.roundName,
        bracket: m.bracket,
        conditional: Boolean(m.conditional),
        left: m.leftRef,
        right: m.rightRef,
        winnerTo: m.winnerTo,
        loserTo: m.loserTo,
        // 決勝リセットが実施された場合は、そちらが1位・2位を上書きする
        decides: m === grandMatch || m === resetMatch ? { winner: 1, loser: 2 } : m === lbFinal ? { loser: 3 } : null,
        playedIf: m.playedIf ? { match: m.playedIf.match.id, side: m.playedIf.side } : null,
        rankStart: 1,
        rankSpan: teams
      }))
    };
  }

  // core/formats/single-elimination.js
  var BYE2 = { type: "bye" };
  var isBye2 = (r) => r.type === "bye";
  function buildSingleElimination({ teams, thirdPlace = true }) {
    validateTeams(teams);
    const size = 2 ** Math.ceil(Math.log2(teams));
    const raw = [];
    let seq = 0;
    const play = (left, right, meta) => {
      if (isBye2(left) && isBye2(right)) return BYE2;
      if (isBye2(left)) return right;
      if (isBye2(right)) return left;
      const m = { ...meta, seq: seq++, left, right };
      raw.push(m);
      return { type: "winner", of: m };
    };
    let cur = seedOrder(size).map(
      (s) => s <= teams ? { type: "team", index: s - 1, label: teamLabel(s - 1) } : BYE2
    );
    let roundNo = 1;
    const levels = [cur.slice()];
    while (cur.length > 1) {
      const next = [];
      for (let i = 0; i < cur.length; i += 2) {
        next.push(play(cur[i], cur[i + 1], { roundNo }));
      }
      cur = next;
      levels.push(cur.slice());
      roundNo += 1;
    }
    const rounds = roundNo - 1;
    const finalMatch = raw[raw.length - 1];
    const semis = raw.filter((m) => m.roundNo === rounds - 1);
    let thirdMatch = null;
    if (thirdPlace && semis.length === 2) {
      thirdMatch = {
        roundNo: rounds,
        seq: seq++,
        left: { type: "loser", of: semis[0] },
        right: { type: "loser", of: semis[1] },
        isThirdPlace: true
      };
      raw.push(thirdMatch);
    }
    const ordered = [...raw].sort(
      (a, b) => a.roundNo - b.roundNo || Number(Boolean(b.isThirdPlace)) - Number(Boolean(a.isThirdPlace)) || a.seq - b.seq
    );
    ordered.forEach((m, i) => {
      m.id = `M${i + 1}`;
      m.no = i + 1;
      m.label = circled(i + 1);
      m.roundName = m.isThirdPlace ? "3\u4F4D\u6C7A\u5B9A\u6226" : m === finalMatch ? "\u6C7A\u52DD" : m.roundNo === rounds - 1 ? "\u6E96\u6C7A\u52DD" : `${m.roundNo}\u56DE\u6226`;
    });
    const resolve = (ref) => ref.type === "team" ? { type: "team", index: ref.index, label: ref.label } : { type: ref.type, match: ref.of.id, matchLabel: ref.of.label };
    for (const m of ordered) {
      m.leftRef = resolve(m.left);
      m.rightRef = resolve(m.right);
      m.winnerTo = null;
      m.loserTo = null;
    }
    for (const m of ordered) {
      for (const ref of [m.left, m.right]) {
        if (ref.type === "winner") ref.of.winnerTo = m.id;
        if (ref.type === "loser") ref.of.loserTo = m.id;
      }
    }
    return {
      format: "single-elimination",
      teams,
      tree: {
        size,
        levels: levels.map((lv) => lv.map((r) => isBye2(r) ? null : resolve(r))),
        title: "\u672C\u6226\u30D6\u30E9\u30B1\u30C3\u30C8"
      },
      teamLabels: Array.from({ length: teams }, (_, i) => teamLabel(i)),
      rounds,
      placements: thirdMatch ? 4 : 2,
      matches: ordered.map((m) => ({
        id: m.id,
        no: m.no,
        label: m.label,
        roundNo: m.roundNo,
        roundName: m.roundName,
        left: m.leftRef,
        right: m.rightRef,
        winnerTo: m.winnerTo,
        loserTo: m.loserTo,
        decides: m === finalMatch ? { winner: 1, loser: 2 } : m === thirdMatch ? { winner: 3, loser: 4 } : null,
        rankStart: 1,
        rankSpan: teams
      }))
    };
  }

  // core/formats/group-stage.js
  function separateSameGroup(slots) {
    const info = (x) => x && x.type === "groupRank" ? x : null;
    const bad = (a, b) => {
      const [x, y] = [info(a), info(b)];
      if (!x || !y) return false;
      return x.group === y.group || x.rank === 1 && y.rank === 1;
    };
    for (let i = 0; i < slots.length; i += 2) {
      if (!bad(slots[i], slots[i + 1])) continue;
      let fixed = false;
      for (let j = 0; j < slots.length && !fixed; j += 2) {
        if (j === i) continue;
        for (const k of [0, 1]) {
          const cand = slots[j + k];
          const partner = slots[j + (1 - k)];
          if (!bad(slots[i], cand) && !bad(slots[i + 1], partner)) {
            slots[j + k] = slots[i + 1];
            slots[i + 1] = cand;
            fixed = true;
            break;
          }
        }
      }
    }
    return slots;
  }
  var groupLabel = (i) => `${String.fromCharCode(65 + i)}\u7D44`;
  function splitGroups(teams, groups) {
    const out = Array.from({ length: groups }, () => []);
    for (let i = 0; i < teams; i++) {
      const round = Math.floor(i / groups);
      const pos = round % 2 === 0 ? i % groups : groups - 1 - i % groups;
      out[pos].push(i);
    }
    return out;
  }
  function defaultGroups(teams) {
    return Math.max(2, Math.round(teams / 4.5));
  }
  function buildGroupStage({ teams, groups, advancePerGroup = 2, thirdPlace = true }) {
    validateTeams(teams);
    const groupCount = groups != null ? groups : defaultGroups(teams);
    if (groupCount < 2) throw new Error(`\u7D44\u6570\u306F2\u4EE5\u4E0A\u306B\u3057\u3066\u304F\u3060\u3055\u3044: ${groupCount}`);
    const members = splitGroups(teams, groupCount);
    const smallest = Math.min(...members.map((g) => g.length));
    if (smallest < 3) {
      throw new Error(
        `${teams}\u30C1\u30FC\u30E0\u3092${groupCount}\u7D44\u306B\u5206\u3051\u308B\u30681\u7D44${smallest}\u30C1\u30FC\u30E0\u306B\u306A\u308A\u307E\u3059\u3002
\u7DCF\u5F53\u305F\u308A\u306E\u610F\u5473\u304C\u8584\u3044\u306E\u3067\u3001\u7D44\u6570\u3092\u6E1B\u3089\u3059\u304B\u30C1\u30FC\u30E0\u6570\u3092\u5897\u3084\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
      );
    }
    if (advancePerGroup >= smallest) {
      throw new Error(
        `1\u7D44${smallest}\u30C1\u30FC\u30E0\u304B\u3089${advancePerGroup}\u30C1\u30FC\u30E0\u9032\u51FA\u3067\u306F\u3001\u4E88\u9078\u3067\u843D\u3061\u308B\u30C1\u30FC\u30E0\u304C\u307B\u3068\u3093\u3069\u51FA\u307E\u305B\u3093\u3002`
      );
    }
    const raw = [];
    let seq = 0;
    members.forEach((team, g) => {
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          raw.push({
            seq: seq++,
            stage: "group",
            group: g,
            roundNo: 1,
            left: { type: "team", index: team[i], label: teamLabel(team[i]) },
            right: { type: "team", index: team[j], label: teamLabel(team[j]) }
          });
        }
      }
    });
    const qualifiers = [];
    for (let r = 1; r <= advancePerGroup; r++) {
      for (let g = 0; g < groupCount; g++) {
        qualifiers.push({ type: "groupRank", group: g, rank: r, label: `${groupLabel(g)}${r}\u4F4D` });
      }
    }
    const size = 2 ** Math.ceil(Math.log2(qualifiers.length));
    const BYE3 = { type: "bye" };
    const slots = seedOrder(size).map((s) => s <= qualifiers.length ? qualifiers[s - 1] : BYE3);
    separateSameGroup(slots);
    const play = (left, right, meta) => {
      if (left.type === "bye" && right.type === "bye") return { win: BYE3, lose: BYE3 };
      if (left.type === "bye") return { win: right, lose: BYE3 };
      if (right.type === "bye") return { win: left, lose: BYE3 };
      const m = { ...meta, seq: seq++, left, right };
      raw.push(m);
      return { win: { type: "winner", of: m }, lose: { type: "loser", of: m } };
    };
    let cur = slots;
    let round = 1;
    const levels = [cur.slice()];
    while (cur.length > 1) {
      const next = [];
      for (let i = 0; i < cur.length; i += 2) {
        next.push(play(cur[i], cur[i + 1], { stage: "knockout", roundNo: round }).win);
      }
      cur = next;
      levels.push(cur.slice());
      round += 1;
    }
    const koRounds = round - 1;
    const finalMatch = raw[raw.length - 1];
    const semis = raw.filter((m) => m.stage === "knockout" && m.roundNo === koRounds - 1);
    let thirdMatch = null;
    if (thirdPlace && semis.length === 2) {
      thirdMatch = {
        stage: "knockout",
        roundNo: koRounds,
        seq: seq++,
        left: { type: "loser", of: semis[0] },
        right: { type: "loser", of: semis[1] },
        isThirdPlace: true
      };
      raw.push(thirdMatch);
    }
    const stageRank = { group: 0, knockout: 1 };
    const ordered = [...raw].sort(
      (a, b) => stageRank[a.stage] - stageRank[b.stage] || (a.stage === "group" ? a.group - b.group : a.roundNo - b.roundNo) || Number(Boolean(b.isThirdPlace)) - Number(Boolean(a.isThirdPlace)) || a.seq - b.seq
    );
    ordered.forEach((m, i) => {
      m.id = `M${i + 1}`;
      m.no = i + 1;
      m.label = circled(i + 1);
      m.roundName = m.stage === "group" ? `\u4E88\u9078 ${groupLabel(m.group)}` : m.isThirdPlace ? "3\u4F4D\u6C7A\u5B9A\u6226" : m === finalMatch ? "\u6C7A\u52DD" : m.roundNo === koRounds - 1 ? "\u6E96\u6C7A\u52DD" : `\u6C7A\u52DDT ${m.roundNo}\u56DE\u6226`;
    });
    const resolve = (ref) => ref.type === "team" ? { type: "team", index: ref.index, label: ref.label } : ref.type === "groupRank" ? { type: "groupRank", group: ref.group, rank: ref.rank, label: ref.label } : { type: ref.type, match: ref.of.id, matchLabel: ref.of.label };
    for (const m of ordered) {
      m.leftRef = resolve(m.left);
      m.rightRef = resolve(m.right);
      m.winnerTo = null;
      m.loserTo = null;
    }
    for (const m of ordered) {
      for (const ref of [m.left, m.right]) {
        if (ref.type === "winner") ref.of.winnerTo = m.id;
        if (ref.type === "loser") ref.of.loserTo = m.id;
      }
    }
    return {
      format: "group-stage",
      teams,
      teamLabels: Array.from({ length: teams }, (_, i) => teamLabel(i)),
      groups: members.map((team, g) => ({
        index: g,
        label: groupLabel(g),
        teams: team,
        advance: advancePerGroup
      })),
      advancePerGroup,
      rounds: koRounds,
      placements: thirdMatch ? 4 : 2,
      tree: {
        title: "\u6C7A\u52DD\u30C8\u30FC\u30CA\u30E1\u30F3\u30C8",
        size,
        levels: levels.map((lv) => lv.map((r) => r.type === "bye" ? null : resolve(r)))
      },
      matches: ordered.map((m) => {
        var _a;
        return {
          id: m.id,
          no: m.no,
          label: m.label,
          stage: m.stage,
          group: (_a = m.group) != null ? _a : null,
          roundNo: m.roundNo,
          roundName: m.roundName,
          left: m.leftRef,
          right: m.rightRef,
          winnerTo: m.winnerTo,
          loserTo: m.loserTo,
          decides: m === finalMatch ? { winner: 1, loser: 2 } : m === thirdMatch ? { winner: 3, loser: 4 } : null,
          rankStart: 1,
          rankSpan: teams
        };
      })
    };
  }

  // core/schedule.js
  function dependenciesOf(match, allMatches) {
    const out = [];
    for (const ref of [match.left, match.right]) {
      if (ref.type === "winner" || ref.type === "loser") out.push(ref.match);
      else if (ref.type === "groupRank") {
        for (const m of allMatches) {
          if (m.stage === "group" && m.group === ref.group) out.push(m.id);
        }
      }
    }
    return out;
  }
  function dependencyOnly(matches, { courts }) {
    const placed = /* @__PURE__ */ new Set();
    const remaining = [...matches];
    const slots = [];
    const ready = (m) => dependenciesOf(m, matches).every((id) => placed.has(id));
    while (remaining.length > 0) {
      const batch = [];
      for (let i = 0; i < remaining.length && batch.length < courts; i++) {
        if (ready(remaining[i])) batch.push(remaining[i]);
      }
      if (batch.length === 0) {
        throw new Error("\u67A0\u5272\u5F53\u304C\u9032\u307F\u307E\u305B\u3093\u3002\u8A66\u5408\u306E\u4F9D\u5B58\u95A2\u4FC2\u304C\u5FAA\u74B0\u3057\u3066\u3044\u307E\u3059\u3002");
      }
      for (const m of batch) {
        remaining.splice(remaining.indexOf(m), 1);
        placed.add(m.id);
      }
      slots.push(batch);
    }
    return slots;
  }
  function countBackToBack(matches, slots) {
    const at = /* @__PURE__ */ new Map();
    slots.forEach((batch, i) => batch.forEach((m) => at.set(m.id, i)));
    let tight = 0;
    for (const m of matches) {
      const deps = dependenciesOf(m, matches).map((id) => at.get(id));
      if (deps.length && at.get(m.id) - Math.max(...deps) === 1) tight += 1;
    }
    return tight;
  }
  function greedy(matches, courts, minGap) {
    const placed = /* @__PURE__ */ new Map();
    const remaining = [...matches];
    const slots = [];
    const gapOf = (m, k) => {
      const deps = dependenciesOf(m, matches).map((id) => placed.get(id));
      if (deps.some((d) => d === void 0)) return -1;
      return deps.length ? k - Math.max(...deps) : Infinity;
    };
    while (remaining.length > 0) {
      const k = slots.length;
      const pick = (need) => {
        const batch2 = [];
        for (const m of remaining) {
          if (batch2.length >= courts) break;
          if (gapOf(m, k) >= need) batch2.push(m);
        }
        return batch2;
      };
      let batch = pick(minGap);
      if (batch.length === 0) batch = pick(1);
      if (batch.length === 0) throw new Error("\u67A0\u5272\u5F53\u304C\u9032\u307F\u307E\u305B\u3093\u3002\u8A66\u5408\u306E\u4F9D\u5B58\u95A2\u4FC2\u304C\u5FAA\u74B0\u3057\u3066\u3044\u307E\u3059\u3002");
      for (const m of batch) {
        remaining.splice(remaining.indexOf(m), 1);
        placed.set(m.id, k);
      }
      slots.push(batch);
    }
    return slots;
  }
  function avoidBackToBack(matches, { courts, gaps = [1, 2, 3], maxExtraSlots = 2 }) {
    const candidates = gaps.map((g) => greedy(matches, courts, g)).map((slots) => ({ slots, tight: countBackToBack(matches, slots) }));
    const shortest = Math.min(...candidates.map((c) => c.slots.length));
    const affordable = candidates.filter((c) => c.slots.length - shortest <= maxExtraSlots);
    return affordable.sort((a, b) => a.tight - b.tight || a.slots.length - b.slots.length)[0].slots;
  }
  function scheduleMatches(tournament, { courts, strategy = dependencyOnly }) {
    if (!Number.isInteger(courts) || courts < 1) {
      throw new Error(`courts \u306F1\u4EE5\u4E0A\u306E\u6574\u6570\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044: ${courts}`);
    }
    const slots = strategy(tournament.matches, { courts });
    return slots.map((batch, i) => ({
      no: i + 1,
      label: `\u67A0 ${i + 1}`,
      matches: batch.map((m, c) => ({ court: c + 1, matchId: m.id, matchLabel: m.label }))
    }));
  }

  // core/scoring.js
  var SCORING = {
    "win-loss": {
      label: "\u52DD\u6557\u306E\u307F",
      options: ["\u5DE6\u306E\u52DD\u3061", "\u53F3\u306E\u52DD\u3061"],
      leftWins: (cell) => `${cell}="\u5DE6\u306E\u52DD\u3061"`
    },
    "sets-of-3": {
      label: "3\u672C\u52DD\u8CA0\uFF08\u65E2\u5B58\u306E\u30D0\u30EC\u30FC\u30FB\u56E3\u4F53\u6226\u3068\u540C\u3058\uFF09",
      options: ["3-0", "2-1", "1-2", "0-3"],
      leftWins: (cell) => `OR(${cell}="3-0",${cell}="2-1")`
    },
    "sets-of-5": {
      label: "5\u30BB\u30C3\u30C8\u30DE\u30C3\u30C1",
      options: ["3-0", "3-1", "3-2", "2-3", "1-3", "0-3"],
      leftWins: (cell) => `OR(${cell}="3-0",${cell}="3-1",${cell}="3-2")`
    }
  };
  function validScore(sc, cell) {
    return `OR(${sc.options.map((o) => `${cell}="${o}"`).join(",")})`;
  }
  function getScoring(name) {
    const s = SCORING[name];
    if (!s) {
      throw new Error(`\u672A\u5BFE\u5FDC\u306E scoring \u3067\u3059: ${name}\uFF08\u5BFE\u5FDC: ${Object.keys(SCORING).join(" / ")}\uFF09`);
    }
    return s;
  }

  // core/index.js
  var BUILDERS = {
    "full-placement": buildFullPlacement,
    "double-elimination": buildDoubleElimination,
    "single-elimination": buildSingleElimination,
    "group-stage": buildGroupStage
  };
  function buildTournament(config) {
    var _a, _b, _c, _d;
    const { format, teams, courts = 1 } = config;
    const build = BUILDERS[format];
    if (!build) {
      throw new Error(`\u672A\u5BFE\u5FDC\u306E\u5F62\u5F0F\u3067\u3059: ${format}\uFF08\u5BFE\u5FDC: ${Object.keys(BUILDERS).join(" / ")}\uFF09`);
    }
    const scoring = (_a = config.scoring) != null ? _a : "win-loss";
    getScoring(scoring);
    const tournament = build({ teams, ...(_b = config.options) != null ? _b : {} });
    tournament.title = (_c = config.title) != null ? _c : "";
    tournament.scoring = scoring;
    tournament.courts = courts;
    tournament.avoidBackToBack = (_d = config.avoidBackToBack) != null ? _d : true;
    tournament.slots = scheduleMatches(tournament, {
      courts,
      strategy: tournament.avoidBackToBack ? avoidBackToBack : dependencyOnly
    });
    tournament.warnings = warningsFor({
      format,
      teams,
      courts,
      matches: tournament.matches.length,
      slots: tournament.slots.length
    });
    return tournament;
  }

  // core/grid.js
  var Grid = class {
    constructor(name) {
      this.name = name;
      this.cells = /* @__PURE__ */ new Map();
      this.merges = [];
      this.borders = [];
      this.paths = [];
      this.advances = [];
      this.columns = /* @__PURE__ */ new Map();
    }
    key(row, col2) {
      return `${row},${col2}`;
    }
    set(row, col2, value2, style = {}) {
      if (!Number.isInteger(row) || row < 1 || !Number.isInteger(col2) || col2 < 1) {
        throw new Error(`${this.name}: \u4E0D\u6B63\u306A\u30BB\u30EB\u4F4D\u7F6E (${row}, ${col2})`);
      }
      const k = this.key(row, col2);
      if (this.cells.has(k)) {
        throw new Error(
          `${this.name}: \u30BB\u30EB ${a1(row, col2)} \u3078\u306E\u4E8C\u91CD\u66F8\u304D\u8FBC\u307F\u3002\u65E2\u5B58="${this.cells.get(k).value}" \u65B0\u898F="${value2}"`
        );
      }
      this.cells.set(k, { row, col: col2, value: value2, style });
      return this;
    }
    merge(r1, c1, r2, c2) {
      const box = { r1, c1, r2, c2 };
      for (const m of this.merges) {
        if (r1 <= m.r2 && m.r1 <= r2 && c1 <= m.c2 && m.c1 <= c2) {
          throw new Error(
            `${this.name}: \u7D50\u5408\u7BC4\u56F2\u306E\u91CD\u306A\u308A ${a1(r1, c1)}:${a1(r2, c2)} \u3068 ${a1(m.r1, m.c1)}:${a1(m.r2, m.c2)}`
          );
        }
      }
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          if (r === r1 && c === c1) continue;
          const cell = this.cells.get(this.key(r, c));
          if (cell && cell.value !== "" && cell.value != null) {
            throw new Error(`${this.name}: \u7D50\u5408\u7BC4\u56F2 ${a1(r1, c1)}:${a1(r2, c2)} \u306E\u5185\u5074 ${a1(r, c)} \u306B\u5024\u304C\u3042\u308A\u307E\u3059`);
          }
        }
      }
      this.merges.push(box);
      return this;
    }
    /** 範囲の片側に罫線を引く。ブラケットの枝を描くのに使う。 */
    border(r1, c1, r2, c2, side) {
      this.borders.push({ r1, c1, r2, c2, side });
      return this;
    }
    /**
     * 勝ち上がり経路。連結列のセルを勝者の色で塗ってマーカー線に見せる。
     * 条件付き書式は罫線に触れないので、枝線そのものは動かせない。
     */
    path(r1, r2, col2, cellRef, winnerOf) {
      this.paths.push({ r1: Math.min(r1, r2), r2: Math.max(r1, r2), col: col2, cellRef, winnerOf });
      return this;
    }
    setColumnWidth(col2, width) {
      this.columns.set(col2, width);
      return this;
    }
    get maxRow() {
      let m = 0;
      for (const c of this.cells.values()) m = Math.max(m, c.row);
      for (const b of this.merges) m = Math.max(m, b.r2);
      return m;
    }
    get maxCol() {
      let m = 0;
      for (const c of this.cells.values()) m = Math.max(m, c.col);
      for (const b of this.merges) m = Math.max(m, b.c2);
      return m;
    }
  };
  function a1(row, col2) {
    let s = "";
    let n = col2;
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s + row;
  }

  // core/rows.js
  var TEAM_INPUT_ROW = 6;
  var MOBILE_ROW = 5;
  var CONTROL_ROW = 2;
  var controlRow = (i) => CONTROL_ROW + i;
  var GAP = 2;
  var STANDINGS_COLS = {
    team: 1,
    wins: 2,
    got: 3,
    lost: 4,
    h2h: 5,
    base: 6,
    janken: 7,
    tie: 8,
    score: 9,
    rank: 10,
    beat: 12
  };
  function standingsLayout(tournament) {
    let row = controlRow(tournament.matches.length) + GAP;
    return tournament.groups.map((group) => {
      const block = {
        group: group.index,
        label: group.label,
        head: row,
        top: row + 1,
        size: group.teams.length,
        cols: STANDINGS_COLS
      };
      row = block.top + block.size + GAP;
      return block;
    });
  }
  function jankenBase(tournament) {
    return MOBILE_ROW + tournament.matches.length + 3;
  }
  function jankenRow(tournament, groupIndex, memberIndex) {
    let row = jankenBase(tournament);
    for (const group of tournament.groups) {
      if (group.index === groupIndex) return row + memberIndex;
      row += group.teams.length;
    }
    throw new Error(`\u7D44\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ${groupIndex}`);
  }

  // core/standings.js
  var W_WEIGHT = 1e6;
  var H2H_WEIGHT = 1e3;
  function groupMatchRows(tournament, groupIndex) {
    const idx = tournament.matches.map((m, i) => ({ m, i })).filter(({ m }) => m.stage === "group" && m.group === groupIndex).map(({ i }) => cellRefs.controlRow(i));
    return { first: Math.min(...idx), last: Math.max(...idx) };
  }
  function writeStandings(g, tournament) {
    const sc = getScoring(tournament.scoring);
    const hasSets = sc.options.some((o) => /^\d+-\d+$/.test(o));
    const blocks = standingsLayout(tournament);
    for (const block of blocks) {
      const group = tournament.groups[block.group];
      const { first, last } = groupMatchRows(tournament, group.index);
      const n = block.size;
      const { head, top, cols } = block;
      g.set(head, cols.team, `${group.label} \u9806\u4F4D\u8868`, { helper: true });
      group.teams.forEach((teamIndex, i) => {
        const r = top + i;
        const me = `$A$${r}`;
        const name = cellRefs.teamName(teamIndex);
        g.set(r, cols.team, `=IF(${name}="","\uFF08${teamLabel(teamIndex)}\u30C1\u30FC\u30E0\uFF09",${name})`, { helper: true });
        g.set(r, cols.wins, `=COUNTIF($E$${first}:$E$${last},${col(cols.team)}${r})`, { helper: true });
        if (hasSets) {
          g.set(
            r,
            cols.got,
            `=SUMPRODUCT(($B$${first}:$B$${last}=${col(cols.team)}${r})*IFERROR(VALUE(LEFT($D$${first}:$D$${last},1)),0))+SUMPRODUCT(($C$${first}:$C$${last}=${col(cols.team)}${r})*IFERROR(VALUE(RIGHT($D$${first}:$D$${last},1)),0))`,
            { helper: true }
          );
          g.set(
            r,
            cols.lost,
            `=SUMPRODUCT(($B$${first}:$B$${last}=${col(cols.team)}${r})*IFERROR(VALUE(RIGHT($D$${first}:$D$${last},1)),0))+SUMPRODUCT(($C$${first}:$C$${last}=${col(cols.team)}${r})*IFERROR(VALUE(LEFT($D$${first}:$D$${last},1)),0))`,
            { helper: true }
          );
        } else {
          g.set(r, cols.got, "=0", { helper: true });
          g.set(r, cols.lost, "=0", { helper: true });
        }
        for (let j = 0; j < n; j++) {
          const opp = `${col(cols.team)}${top + j}`;
          g.set(
            r,
            cols.beat + j,
            i === j ? "=0" : `=SUMPRODUCT(($E$${first}:$E$${last}=${col(cols.team)}${r})*(($B$${first}:$B$${last}=${opp})+($C$${first}:$C$${last}=${opp})))`,
            { helper: true }
          );
        }
        const beatRange = `${col(cols.beat)}${r}:${col(cols.beat + n - 1)}${r}`;
        const winsRange = `${col(cols.wins)}$${top}:${col(cols.wins)}$${top + n - 1}`;
        g.set(
          r,
          cols.h2h,
          `=SUMPRODUCT(${beatRange},TRANSPOSE(N(${winsRange}=${col(cols.wins)}${r})))`,
          { helper: true }
        );
        const ratio = `IFERROR(${col(cols.got)}${r}/MAX(${col(cols.lost)}${r},1),0)`;
        g.set(
          r,
          cols.base,
          `=${col(cols.wins)}${r}*${W_WEIGHT}+${col(cols.h2h)}${r}*${H2H_WEIGHT}+${ratio}*10`,
          { helper: true }
        );
        const baseRange = `${col(cols.base)}$${top}:${col(cols.base)}$${top + n - 1}`;
        g.set(
          r,
          cols.tie,
          `=IF(COUNTIF(${baseRange},${col(cols.base)}${r})>1,"\u8981\u3058\u3083\u3093\u3051\u3093","")`,
          { helper: true }
        );
        g.set(r, cols.janken, `=IFERROR(${jankenInput(tournament, block.group, i)},"")`, { helper: true });
        const jk = `IF(${col(cols.janken)}${r}="",0,(${n + 1}-${col(cols.janken)}${r})*0.01)`;
        g.set(r, cols.score, `=${col(cols.base)}${r}+${jk}-${i}*0.0001`, { helper: true });
        const scoreRange = `${col(cols.score)}$${top}:${col(cols.score)}$${top + n - 1}`;
        g.set(r, cols.rank, `=RANK(${col(cols.score)}${r},${scoreRange})`, { helper: true });
      });
    }
    return blocks;
  }
  function groupRankFormula(tournament, groupIndex, rank) {
    const b = standingsLayout(tournament).find((x) => x.group === groupIndex);
    const teams = `'${TABS.control}'!${col(b.cols.team)}$${b.top}:${col(b.cols.team)}$${b.top + b.size - 1}`;
    const ranks = `'${TABS.control}'!${col(b.cols.rank)}$${b.top}:${col(b.cols.rank)}$${b.top + b.size - 1}`;
    return `IFERROR(INDEX(${teams},MATCH(${rank},${ranks},0)),"")`;
  }
  function jankenInput(tournament, groupIndex, memberIndex) {
    return `'${TABS.mobile}'!$C$${jankenRow(tournament, groupIndex, memberIndex)}`;
  }
  function col(n) {
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  // core/sheets.js
  var TABS = {
    bracket: "\u30C8\u30FC\u30CA\u30E1\u30F3\u30C8\u8868",
    progress: "\u9032\u884C\u8868",
    mobile: "\u5165\u529B\u7528",
    control: "\u8A66\u5408\u7BA1\u7406"
  };
  var cellRefs = {
    teamName: (i) => `'${TABS.progress}'!$B$${TEAM_INPUT_ROW + i}`,
    mobileInput: (i) => `'${TABS.mobile}'!$C$${MOBILE_ROW + i}`,
    controlRow
  };
  var matchIndex = (t, id) => t.matches.findIndex((m) => m.id === id);
  function controlCell(tournament, matchId, kind) {
    const col2 = kind === "winner" ? "E" : "F";
    return `'${TABS.control}'!$${col2}$${cellRefs.controlRow(matchIndex(tournament, matchId))}`;
  }
  function liveRefFormula(tournament, ref) {
    if (ref.type === "team") {
      const c = cellRefs.teamName(ref.index);
      return `=IF(${c}="","\uFF08${ref.label}\u30C1\u30FC\u30E0\uFF09",${c})`;
    }
    if (ref.type === "groupRank") {
      const f = groupRankFormula(tournament, ref.group, ref.rank);
      return `=IF(${f}="","${ref.label}",${f})`;
    }
    const cell = controlCell(tournament, ref.match, ref.type);
    const placeholder = `${ref.matchLabel}\u306E${ref.type === "winner" ? "\u52DD\u8005" : "\u6557\u8005"}`;
    return `=IF(${cell}="","${placeholder}",${cell})`;
  }
  function layoutControlSheet(tournament) {
    const g = new Grid(TABS.control);
    const sc = getScoring(tournament.scoring);
    const head = ["\u8A66\u5408", "\u5DE6\u30C1\u30FC\u30E0", "\u53F3\u30C1\u30FC\u30E0", "\u7D50\u679C", "\u52DD\u8005", "\u6557\u8005", "\u72B6\u614B"];
    head.forEach((h, i) => g.set(1, i + 1, h, { bold: true }));
    tournament.matches.forEach((m, i) => {
      const r = cellRefs.controlRow(i);
      const side = (ref) => {
        if (ref.type === "team" || ref.type === "groupRank") return liveRefFormula(tournament, ref);
        const src = cellRefs.controlRow(matchIndex(tournament, ref.match));
        const col2 = ref.type === "winner" ? "E" : "F";
        return `=IF($${col2}$${src}="","",$${col2}$${src})`;
      };
      const won = sc.leftWins(`$D${r}`);
      g.set(r, 1, m.label);
      if (m.playedIf) {
        const src = cellRefs.controlRow(matchIndex(tournament, m.playedIf.match));
        const side2 = m.playedIf.side === "left" ? "B" : "C";
        const cond = `AND($E$${src}<>"",$E$${src}=$${side2}$${src})`;
        g.set(r, 2, `=IF(${cond},$E$${src},"")`);
        g.set(r, 3, `=IF(${cond},$F$${src},"")`);
      } else {
        g.set(r, 2, side(m.left));
        g.set(r, 3, side(m.right));
      }
      g.set(r, 4, `=${cellRefs.mobileInput(i)}`);
      const valid = validScore(sc, `$D${r}`);
      g.set(r, 5, `=IF(NOT(${valid}),"",IF(${won},$B${r},$C${r}))`);
      g.set(r, 6, `=IF(NOT(${valid}),"",IF(${won},$C${r},$B${r}))`);
      g.set(r, 7, `=IF($D${r}="","\u672A\u5165\u529B",IF(${validScore(sc, `$D${r}`)},"\u78BA\u5B9A","\u5165\u529B\u30A8\u30E9\u30FC"))`);
    });
    if (tournament.groups) writeStandings(g, tournament);
    return g;
  }
  function layoutMobileSheet(tournament) {
    const g = new Grid(TABS.mobile);
    g.frozenRows = MOBILE_ROW - 1;
    const sc = getScoring(tournament.scoring);
    g.setColumnWidth(1, 8).setColumnWidth(2, 22).setColumnWidth(3, 12).setColumnWidth(4, 14);
    g.set(1, 1, tournament.title || "\u7D50\u679C\u5165\u529B", { role: "title" });
    g.set(2, 1, `\u9EC4\u8272\u3044\u30BB\u30EB\u306B\u7D50\u679C\uFF08${sc.options.join(" / ")}\uFF09\u3092\u5165\u308C\u308B\u3068\u3001\u5168\u30BF\u30D6\u306E\u52DD\u8005\u30FB\u6B21\u6226\u30FB\u8272\u304C\u81EA\u52D5\u3067\u66F4\u65B0\u3055\u308C\u307E\u3059\u3002`, { role: "note" });
    ["\u8A66\u5408", "\u5BFE\u6226", "\u7D50\u679C", "\u52DD\u8005"].forEach((h, i) => g.set(4, i + 1, h, { role: "tableHeader" }));
    tournament.matches.forEach((m, i) => {
      const r = MOBILE_ROW + i;
      const c = cellRefs.controlRow(i);
      g.set(r, 1, m.label, { role: "label" });
      g.set(r, 2, `='${TABS.control}'!$B$${c}&" vs "&'${TABS.control}'!$C$${c}`, { role: "slot" });
      g.set(r, 3, "", { role: "input", input: true, validation: sc.options });
      g.set(r, 4, `=IF('${TABS.control}'!$E$${c}="","",'${TABS.control}'!$E$${c})`, { role: "slot" });
    });
    if (tournament.groups) renderJankenInput(g, tournament);
    return g;
  }
  function renderJankenInput(g, tournament) {
    let row = MOBILE_ROW + tournament.matches.length + 1;
    g.set(row, 1, "\u25A0 \u3058\u3083\u3093\u3051\u3093\uFF08\u898F\u5B9A\u3067\u9806\u4F4D\u304C\u6C7A\u307E\u3089\u306A\u3044\u7D44\u3060\u3051\u8A18\u5165\uFF09", { role: "section" });
    g.merge(row, 1, row, 4);
    row += 1;
    ["\u7D44", "\u30C1\u30FC\u30E0\u540D", "\u9806\u4F4D", "\u72B6\u614B"].forEach((h, i) => g.set(row, i + 1, h, { role: "tableHeader" }));
    row += 1;
    const blocks = standingsLayout(tournament);
    for (const block of blocks) {
      const group = tournament.groups[block.group];
      group.teams.forEach((teamIndex, i) => {
        const expected = jankenRow(tournament, group.index, i);
        if (row !== expected) {
          throw new Error(`\u3058\u3083\u3093\u3051\u3093\u5165\u529B\u6B04\u306E\u884C\u304C\u305A\u308C\u3066\u3044\u307E\u3059: \u8868\u793A=${row} \u53C2\u7167=${expected}`);
        }
        const name = cellRefs.teamName(teamIndex);
        g.set(row, 1, group.label, { role: "body" });
        g.set(row, 2, `=IF(${name}="","\uFF08${teamLabel(teamIndex)}\u30C1\u30FC\u30E0\uFF09",${name})`, { role: "slot" });
        g.set(row, 4, `=IFERROR('${TABS.control}'!$H$${block.top + i},"")`, { role: "body" });
        g.set(row, 3, "", { role: "optional", jankenOf: `$D$${row}` });
        row += 1;
      });
    }
  }
  function layoutProgressSheet(tournament) {
    const g = new Grid(TABS.progress);
    g.frozenRows = 2;
    g.setColumnWidth(1, 8).setColumnWidth(2, 20).setColumnWidth(3, 8).setColumnWidth(4, 26).setColumnWidth(5, 12).setColumnWidth(6, 16);
    g.set(1, 1, tournament.title || `\u9032\u884C\u8868\uFF08${tournament.teams}\u30C1\u30FC\u30E0\u30FB\u5168${tournament.matches.length}\u8A66\u5408\uFF09`, { role: "title" });
    g.set(2, 1, `\u30B3\u30FC\u30C8${tournament.courts}\u9762\uFF0F\u5168${tournament.slots.length}\u67A0\uFF0F\u5168${tournament.matches.length}\u8A66\u5408\uFF0F${eliminationRule(tournament)}`, { role: "note" });
    g.set(4, 1, "\u25A0 \u51FA\u5834\u30C1\u30FC\u30E0\uFF08\u3053\u3053\u306B\u8A18\u5165\u3059\u308B\u3068\u5168\u30BF\u30D6\u306E\u5BFE\u6226\u30AB\u30FC\u30C9\u306B\u53CD\u6620\u3055\u308C\u307E\u3059\uFF09", { role: "section" });
    g.merge(4, 1, 4, 6);
    g.set(5, 1, "\u8A18\u53F7", { role: "tableHeader" });
    g.set(5, 2, "\u30C1\u30FC\u30E0\u540D", { role: "tableHeader" });
    tournament.teamLabels.forEach((label, i) => {
      g.set(TEAM_INPUT_ROW + i, 1, label, { role: "label" });
      g.set(TEAM_INPUT_ROW + i, 2, "", { role: "input", input: true });
    });
    let row = TEAM_INPUT_ROW + tournament.teams + 1;
    g.set(row, 1, `\u25A0 \u9032\u884C\u9806\uFF08\u67A0\u306E\u4E2D\u306E\u8A66\u5408\u306F\u540C\u6642\u306B\u9032\u884C\u3002\u67A0\u304C\u7D42\u308F\u3063\u305F\u3089\u6B21\u306E\u67A0\u3078\uFF09${tournament.avoidBackToBack ? "\u3000\u203B\u9023\u6226\u3092\u306A\u308B\u3079\u304F\u907F\u3051\u3066\u4E26\u3079\u3066\u3044\u307E\u3059" : ""}`, { role: "section" });
    g.merge(row, 1, row, 6);
    row += 1;
    ["\u67A0", "\u30B3\u30FC\u30C8", "\u8A66\u5408", "\u5BFE\u6226\u30AB\u30FC\u30C9", "\u7D50\u679C", "\u52DD\u8005"].forEach((h, i) => g.set(row, i + 1, h, { role: "tableHeader" }));
    row += 1;
    for (const slot of tournament.slots) {
      for (const [n, entry] of slot.matches.entries()) {
        const i = matchIndex(tournament, entry.matchId);
        const c = cellRefs.controlRow(i);
        g.set(row, 1, n === 0 ? slot.label : "", { role: "label" });
        g.set(row, 2, `\u30B3\u30FC\u30C8${entry.court}`, { role: "body" });
        g.set(row, 3, entry.matchLabel, { role: "label" });
        g.set(row, 4, `='${TABS.control}'!$B$${c}&" vs "&'${TABS.control}'!$C$${c}`, { role: "slot" });
        g.set(row, 5, `=IF('${TABS.control}'!$D$${c}="","",'${TABS.control}'!$D$${c})`, { role: "body" });
        g.set(row, 6, `=IF('${TABS.control}'!$E$${c}="","",'${TABS.control}'!$E$${c})`, { role: "slot" });
        row += 1;
      }
    }
    return g;
  }

  // core/layout.js
  var COLUMNS = [
    { col: 1, width: 9 },
    // A: 試合番号（決勝R のような3文字ラベルまで収める）
    { col: 2, width: 20 },
    // B: 左チーム / ブラケット第1列
    { col: 3, width: 4 },
    // C: vs / 連結線（実物と同じ30px。ここを塗って経路の帯にする）
    { col: 4, width: 20 },
    // D: 右チーム / ブラケット第2列
    { col: 5, width: 4 },
    // E: 連結線
    // F は下の表の「行き先」「決定方法」にも使うが、幅はブラケットの箱に合わせる。
    // ここだけ広くすると、ブラケットの3ラウンド目の箱だけが横に伸び、
    // 経路を塗ったときに1箇所だけ赤い板になる。表側は 5〜6列の結合で幅を確保する。
    { col: 6, width: 20 }
    // F: 説明 / ブラケット第3列
  ];
  function bracketCell(base, round, index) {
    return {
      row: base + 2 ** (round + 1) * index + 2 ** round,
      col: 2 + 2 * round
    };
  }
  function bracketHeight(entrants) {
    return entrants * 2;
  }
  var helperRow = (matchIndex2) => matchIndex2 + 2;
  function lastBracketCol(tournament) {
    return tournament.tree ? 2 + 2 * (tournament.tree.levels.length - 1) : 6;
  }
  function helperCols(tournament) {
    const last = lastBracketCol(tournament);
    return { winner: last + 2, loser: last + 3 };
  }
  function helperCell(tournament, matchId, kind) {
    const i = tournament.matches.findIndex((m) => m.id === matchId);
    const col2 = helperCols(tournament)[kind];
    return `$${a1(1, col2).replace(/\d+$/, "")}$${helperRow(i)}`;
  }
  function layoutBracketSheet(tournament) {
    const g = new Grid("\u30C8\u30FC\u30CA\u30E1\u30F3\u30C8\u8868");
    for (const { col: col2, width } of COLUMNS) g.setColumnWidth(col2, width);
    const hc = helperCols(tournament);
    g.set(1, hc.winner, "\uFF08\u5185\u90E8\uFF09\u52DD\u8005", { helper: true });
    g.set(1, hc.loser, "\uFF08\u5185\u90E8\uFF09\u6557\u8005", { helper: true });
    tournament.matches.forEach((m, i) => {
      g.set(helperRow(i), hc.winner, `=${controlCell(tournament, m.id, "winner")}`, { helper: true });
      g.set(helperRow(i), hc.loser, `=${controlCell(tournament, m.id, "loser")}`, { helper: true });
    });
    for (let c = 7; c <= lastBracketCol(tournament); c++) {
      g.setColumnWidth(c, c % 2 === 0 ? 20 : 4);
    }
    let row = 1;
    g.set(row, 1, tournament.title || `\u30C8\u30FC\u30CA\u30E1\u30F3\u30C8\u8868\uFF08${tournament.teams}\u30C1\u30FC\u30E0\u30FB\u5168${tournament.matches.length}\u8A66\u5408\uFF09`, { role: "title" });
    row += 1;
    g.set(row, 1, subtitle(tournament), { role: "note" });
    row += 2;
    if (tournament.groups) row = renderGroupStandings(g, tournament, row);
    const inBracket = /* @__PURE__ */ new Set();
    if (tournament.tree) {
      row = renderTree(g, tournament, row, inBracket);
    }
    if (tournament.loserTree) {
      row = renderLoserTree(g, tournament, row, inBracket);
    }
    const groups = tournament.tree ? [] : terminalGroups(tournament);
    for (const gr of groups) {
      for (const id of [...gr.semis.map((s) => s.id), gr.final.id, gr.consolation.id]) inBracket.add(id);
    }
    const keyOf = (m) => {
      var _a;
      return `${(_a = m.bracket) != null ? _a : "-"}/${m.roundNo}/${m.roundName}`;
    };
    const listed = (m) => !inBracket.has(m.id) && m.stage !== "group";
    const listKeys = [];
    for (const m of tournament.matches) {
      if (!listed(m)) continue;
      if (!listKeys.includes(keyOf(m))) listKeys.push(keyOf(m));
    }
    for (const key of listKeys) {
      const ms = tournament.matches.filter((m) => listed(m) && keyOf(m) === key);
      const span = ms.length > 1 ? `\uFF08${ms[0].label}\u301C${ms[ms.length - 1].label}\uFF09` : "";
      const note = ms[0].roundNo === 1 && ms[0].bracket !== "L" && !tournament.tree ? "\u3000\u203B\u3053\u3053\u3060\u3051\u62BD\u9078\u3067\u6C7A\u3081\u308B" : "";
      g.set(row, 1, `\u25A0 ${ms[0].roundName}${span}${note}`, { role: "section" });
      g.merge(row, 1, row, 6);
      row += 1;
      for (const c of [1, 2, 3, 4, 5, 6]) g.set(row, c, "", { role: "tableHeader" });
      g.cells.get(`${row},1`).value = "\u8A66\u5408";
      g.cells.get(`${row},2`).value = "\u5BFE\u6226\u30AB\u30FC\u30C9";
      g.cells.get(`${row},5`).value = "\u884C\u304D\u5148";
      g.merge(row, 2, row, 4);
      g.merge(row, 5, row, 6);
      row += 1;
      for (const m of ms) {
        g.set(row, 1, m.label, { role: "label" });
        g.set(row, 2, liveRefFormula(tournament, m.left), { role: "slot", winnerOf: m.id });
        g.set(row, 3, "vs", { role: "body" });
        g.set(row, 4, liveRefFormula(tournament, m.right), { role: "slot", winnerOf: m.id });
        g.set(row, 5, destinationText(tournament, m), { role: "note" });
        g.set(row, 6, "", { role: "note" });
        g.merge(row, 5, row, 6);
        row += 1;
      }
      row += 1;
    }
    for (const group of groups) {
      g.set(row, 1, `\u25A0 ${group.title}`, { role: "section" });
      g.merge(row, 1, row, 6);
      row += 1;
      const base = row;
      const semiLabels = group.semis.map((x) => x.label).join("\u30FB");
      g.set(base, 2, "\u9032\u51FA\u30C1\u30FC\u30E0", { role: "tableHeader" }).set(base, 3, "", { role: "tableHeader" }).set(base, 4, `${group.semis[0].roundName} ${semiLabels} \u306E\u52DD\u8005`, { role: "tableHeader" }).set(base, 5, "", { role: "tableHeader" }).set(base, 6, `${group.final.roundName} ${group.final.label}`, { role: "tableHeader" });
      for (let i = 0; i < group.entrants.length; i++) {
        const { row: r, col: c } = bracketCell(base, 0, i);
        const nextId = group.semis[Math.floor(i / 2)].id;
        g.set(r, c, liveRefFormula(tournament, group.entrants[i]), { role: "team", winnerOf: nextId });
        const up = bracketCell(base, 1, Math.floor(i / 2));
        g.path(r, up.row, c + 1, a1(r, c), nextId);
      }
      for (let i = 0; i < group.semis.length; i++) {
        const { row: r, col: c } = bracketCell(base, 1, i);
        g.set(r, c, liveRefFormula(tournament, { type: "winner", match: group.semis[i].id, matchLabel: group.semis[i].label }), {
          winnerOf: group.final.id
        });
      }
      drawBranches(g, base, [group.entrants.length, group.semis.length, 1]);
      {
        const { row: r, col: c } = bracketCell(base, 2, 0);
        g.set(r, c, `=IF(${controlCell(tournament, group.final.id, "winner")}="","\u2605 ${group.final.decides.winner}\u4F4D","\u2605 "&${controlCell(tournament, group.final.id, "winner")})`, { role: "slot", championOf: group.final.id });
      }
      row = base + bracketHeight(group.entrants.length);
      g.set(row, 1, group.consolation.label, { role: "label" });
      g.set(row, 2, liveRefFormula(tournament, group.consolation.left), { role: "slot", winnerOf: group.consolation.id });
      g.set(row, 3, "vs", { role: "body" });
      g.set(row, 4, liveRefFormula(tournament, group.consolation.right), { role: "slot", winnerOf: group.consolation.id });
      g.set(row, 5, `${group.consolation.roundName}\uFF08\u52DD\u8005\uFF1D${group.consolation.decides.winner}\u4F4D\uFF0F\u6557\u8005\uFF1D${group.consolation.decides.loser}\u4F4D\uFF09`, { role: "note" });
      g.set(row, 6, "", { role: "note" });
      g.merge(row, 5, row, 6);
      row += 2;
    }
    g.set(row, 1, "\u25A0 \u6700\u7D42\u9806\u4F4D", { role: "section" });
    g.merge(row, 1, row, 6);
    row += 1;
    for (const c of [1, 2, 3, 4, 5, 6]) g.set(row, c, "", { role: "tableHeader" });
    g.cells.get(`${row},1`).value = "\u9806\u4F4D";
    g.cells.get(`${row},2`).value = "\u30C1\u30FC\u30E0\u540D";
    g.cells.get(`${row},5`).value = "\u6C7A\u5B9A\u65B9\u6CD5";
    g.merge(row, 2, row, 4);
    g.merge(row, 5, row, 6);
    row += 1;
    const placements = tournament.matches.filter((x) => x.decides).flatMap((m) => [
      m.decides.winner != null && { rank: m.decides.winner, text: matchDesc(m, "\u52DD\u8005"), cell: controlCell(tournament, m.id, "winner"), matchId: m.id },
      m.decides.loser != null && { rank: m.decides.loser, text: matchDesc(m, "\u6557\u8005"), cell: controlCell(tournament, m.id, "loser"), matchId: m.id }
    ]).filter(Boolean);
    const byRank = /* @__PURE__ */ new Map();
    for (const p of placements) {
      if (!byRank.has(p.rank)) byRank.set(p.rank, []);
      byRank.get(p.rank).push(p);
    }
    for (const rank of [...byRank.keys()].sort((a, b) => a - b)) {
      const cands = byRank.get(rank);
      const formula = cands.slice().reverse().reduceRight((acc, c) => `IF(${c.cell}<>"",${c.cell},${acc})`, '""');
      g.set(row, 1, `${rank}\u4F4D`, { role: "label" });
      g.set(row, 2, `=${formula}`, rank === 1 ? { role: "slot", championOf: cands.at(-1).matchId } : { role: "slot" });
      for (const c of [3, 4]) g.set(row, c, "", { role: "slot" });
      g.merge(row, 2, row, 4);
      g.set(row, 5, cands.map((c) => c.text).join(" \uFF0F "), { role: "note" });
      g.set(row, 6, "", { role: "note" });
      g.merge(row, 5, row, 6);
      row += 1;
    }
    return g;
  }
  function destinationText(tournament, m) {
    const label = (id) => tournament.matches.find((x) => x.id === id).label;
    const parts = [];
    if (m.winnerTo) parts.push(`\u52DD\u8005\u2192${label(m.winnerTo)}`);
    if (m.loserTo) parts.push(`\u6557\u8005\u2192${label(m.loserTo)}`);
    if (!parts.length && m.decides) {
      if (m.decides.winner != null) parts.push(`\u52DD\u8005\uFF1D${m.decides.winner}\u4F4D`);
      if (m.decides.loser != null) parts.push(`\u6557\u8005\uFF1D${m.decides.loser}\u4F4D`);
    }
    return parts.join("\u3000\uFF0F\u3000");
  }
  function matchDesc(m, kind) {
    return m.label === m.roundName ? `${m.label}\u306E${kind}` : `${m.label} ${m.roundName}\u306E${kind}`;
  }
  function terminalGroups(tournament) {
    const semis = tournament.matches.filter(
      (m) => m.roundNo === tournament.rounds - 1 && m.rankSpan === 4
    );
    const groups = [];
    const seen = /* @__PURE__ */ new Set();
    for (const s of semis) {
      if (seen.has(s.rankStart)) continue;
      seen.add(s.rankStart);
      const pair = semis.filter((x) => x.rankStart === s.rankStart);
      const final = tournament.matches.find((m) => m.id === pair[0].winnerTo);
      const consolation = tournament.matches.find((m) => m.id === pair[0].loserTo);
      groups.push({
        title: `${s.rankStart}\u301C${s.rankStart + 3}\u4F4D \u30D6\u30E9\u30B1\u30C3\u30C8${s.rankStart === 1 ? "\uFF08\u4E0A\u5C71\uFF09" : ""}`,
        entrants: pair.flatMap((p) => [p.left, p.right]),
        semis: pair,
        final,
        consolation
      });
    }
    return groups.sort((a, b) => a.semis[0].rankStart - b.semis[0].rankStart);
  }
  function drawBranches(g, base, levelSizes, filled) {
    const has = filled != null ? filled : () => true;
    for (let j = 0; j < levelSizes.length - 1; j++) {
      for (let p = 0; p < levelSizes[j + 1]; p++) {
        if (!has(j + 1, p)) continue;
        const top = bracketCell(base, j, p * 2);
        const bottom = bracketCell(base, j, p * 2 + 1);
        const parent = bracketCell(base, j + 1, p);
        const conn = top.col + 1;
        const bothPlay = has(j, p * 2) && has(j, p * 2 + 1);
        if (!bothPlay) {
          g.border(parent.row, top.col, parent.row, conn, "bottom");
          continue;
        }
        g.border(top.row, top.col, top.row, top.col, "bottom");
        g.border(bottom.row, bottom.col, bottom.row, bottom.col, "bottom");
        g.border(top.row + 1, conn, bottom.row, conn, "left");
        g.border(parent.row, conn, parent.row, conn, "bottom");
      }
    }
    const last = levelSizes.length - 1;
    if (has(last, 0)) {
      const root = bracketCell(base, last, 0);
      g.border(root.row, root.col, root.row, root.col, "bottom");
    }
  }
  function eliminationRule(t) {
    if (t.format === "full-placement") return `\u5404\u30C1\u30FC\u30E0${t.rounds}\u8A66\u5408`;
    if (t.format === "double-elimination") return "2\u6557\u3067\u6557\u9000";
    if (t.format === "group-stage") {
      const per = t.groups[0].teams.length - 1;
      return `\u4E88\u9078\u306F\u5404\u30C1\u30FC\u30E0${per}\u8A66\u5408\uFF0F\u6C7A\u52DDT\u306F1\u6557\u3067\u6557\u9000`;
    }
    return "1\u6557\u3067\u6557\u9000";
  }
  function nextMatchOf(tournament, ref, parentRef) {
    var _a, _b;
    if (parentRef && parentRef.type === "winner") return parentRef.match;
    if (ref && ref.type === "winner") {
      return (_b = (_a = tournament.matches.find((m) => m.id === ref.match)) == null ? void 0 : _a.winnerTo) != null ? _b : null;
    }
    return null;
  }
  function subtitle(t) {
    return `\u5168${t.matches.length}\u8A66\u5408\uFF0F${eliminationRule(t)}\uFF0F1\u4F4D\u301C${t.placements}\u4F4D\u307E\u3067\u78BA\u5B9A`;
  }
  function renderTree(g, tournament, startRow, inBracket) {
    var _a;
    const { levels } = tournament.tree;
    let row = startRow;
    const hasSeed = levels[0].some((x) => !x);
    const seedNote = hasSeed ? "\u3000\uFF08\u2605\uFF1D\u30B7\u30FC\u30C9\u30671\u56DE\u6226\u306A\u3057\uFF09" : "";
    g.set(row, 1, `\u25A0 ${(_a = tournament.tree.title) != null ? _a : "\u672C\u6226"}${seedNote}`, { role: "section" });
    g.merge(row, 1, row, 6);
    row += 1;
    const base = row;
    drawBranches(
      g,
      base,
      levels.map((lv) => lv.length),
      (j, i) => Boolean(levels[j] && levels[j][i])
    );
    levels.forEach((level, j) => {
      level.forEach((ref, i) => {
        if (!ref) return;
        if (j > 0 && ref.type !== "winner") return;
        const { row: slotRow, col: c } = bracketCell(base, j, i);
        const up = levels[j + 1] ? bracketCell(base, j + 1, Math.floor(i / 2)) : null;
        const seeded = up && !level[i % 2 === 0 ? i + 1 : i - 1];
        const r = seeded ? up.row : slotRow;
        const parent = levels[j + 1] ? levels[j + 1][Math.floor(i / 2)] : null;
        const style = { role: j === 0 ? "team" : "slot" };
        const next = nextMatchOf(tournament, ref, parent);
        if (next) style.winnerOf = next;
        else if (ref.type === "winner") style.championOf = ref.match;
        g.set(r, c, liveRefFormula(tournament, ref), style);
        if (seeded && j === 0) g.set(r, c - 1, "\u2605", { role: "seed" });
        if (ref.type === "winner") inBracket.add(ref.match);
        if (style.winnerOf && up) {
          g.path(r, up.row, c + 1, a1(r, c), style.winnerOf);
        }
      });
    });
    return base + bracketHeight(levels[0].length) + 1;
  }
  function renderLoserTree(g, tournament, startRow, inBracket) {
    const { levels, title } = tournament.loserTree;
    if (!levels.length) return startRow;
    let row = startRow;
    g.set(row, 1, `\u25A0 ${title}`, { role: "section" });
    g.merge(row, 1, row, 6);
    row += 1;
    const base = row;
    let rows = levels[0].refs.map((_, i) => base + 2 * i + 1);
    const placed = [{ rows, level: levels[0], col: 2 }];
    for (let j = 1; j < levels.length; j++) {
      if (levels[j].kind === "minor") {
        const next = [];
        for (let i = 0; i < levels[j].refs.length; i++) {
          next.push(Math.round((rows[i * 2] + rows[i * 2 + 1]) / 2));
        }
        rows = next;
      }
      placed.push({ rows: rows.slice(), level: levels[j], col: 2 + 2 * j });
    }
    placed.forEach((p, j) => {
      p.level.refs.forEach((ref, i) => {
        if (!ref) return;
        if (j > 0 && ref.type !== "winner") return;
        const parent = placed[j + 1];
        const parentRef = parent ? parent.level.refs[parent.level.kind === "minor" ? Math.floor(i / 2) : i] : null;
        const style = { role: j === 0 ? "team" : "slot" };
        const next2 = nextMatchOf(tournament, ref, parentRef);
        if (next2) style.winnerOf = next2;
        else if (ref.type === "winner") style.championOf = ref.match;
        g.set(p.rows[i], p.col, liveRefFormula(tournament, ref), style);
        if (ref.type === "winner") inBracket.add(ref.match);
        if (style.winnerOf && parent) {
          const idx = parent.level.kind === "minor" ? Math.floor(i / 2) : i;
          g.path(p.rows[i], parent.rows[idx], p.col + 1, a1(p.rows[i], p.col), style.winnerOf);
        }
        g.border(p.rows[i], p.col, p.rows[i], p.col, "bottom");
        if (j > 0 && p.level.kind === "major") {
          g.border(p.rows[i], p.col - 1, p.rows[i], p.col - 1, "bottom");
        }
      });
      const next = placed[j + 1];
      if (next && next.level.kind === "minor") {
        for (let k = 0; k < next.level.refs.length; k++) {
          if (!next.level.refs[k]) continue;
          const top = p.rows[k * 2];
          const bottom = p.rows[k * 2 + 1];
          const conn = p.col + 1;
          g.border(top + 1, conn, bottom, conn, "left");
          g.border(next.rows[k], conn, next.rows[k], conn, "bottom");
        }
      }
    });
    return base + levels[0].refs.length * 2 + 1;
  }
  function renderGroupStandings(g, tournament, startRow) {
    const blocks = standingsLayout(tournament);
    const ctrl = (col2, row2) => `'${TABS.control}'!${col2}$${row2}`;
    let row = startRow;
    for (const block of blocks) {
      const group = tournament.groups[block.group];
      g.set(row, 1, `\u25A0 \u4E88\u9078 ${group.label}\uFF08\u4E0A\u4F4D${group.advance}\u30C1\u30FC\u30E0\u304C\u6C7A\u52DD\u30C8\u30FC\u30CA\u30E1\u30F3\u30C8\u3078\uFF09`, { role: "section" });
      g.merge(row, 1, row, 6);
      row += 1;
      for (const c of [1, 2, 3, 4, 5, 6]) g.set(row, c, "", { role: "tableHeader" });
      g.cells.get(`${row},1`).value = "\u9806\u4F4D";
      g.cells.get(`${row},2`).value = "\u30C1\u30FC\u30E0\u540D";
      g.cells.get(`${row},3`).value = "\u52DD";
      g.cells.get(`${row},4`).value = "\u30BB\u30C3\u30C8";
      g.cells.get(`${row},5`).value = "\u76F4\u5BFE";
      g.cells.get(`${row},6`).value = "\u3058\u3083\u3093\u3051\u3093";
      row += 1;
      const bandTop = row;
      for (let i = 0; i < block.size; i++) {
        const r = block.top + i;
        g.set(row, 1, `=${ctrl("J", r)}`, { role: "label" });
        g.set(row, 2, `=${ctrl("A", r)}`, { role: "slot" });
        g.set(row, 3, `=${ctrl("B", r)}`, { role: "body" });
        g.set(row, 4, `=${ctrl("C", r)}&"-"&${ctrl("D", r)}`, { role: "body" });
        g.set(row, 5, `=${ctrl("E", r)}`, { role: "body" });
        g.set(row, 6, `=IFERROR(${ctrl("G", r)},"")`, { role: "body", jankenOf: ctrl("H", r) });
        g.set(row, 7, `=${ctrl("H", r)}`, { helper: true });
        row += 1;
      }
      g.advances.push({ r1: bandTop, r2: row - 1, c1: 1, c2: 5, rankCol: 1, cutoff: group.advance });
      row += 1;
    }
    g.set(row, 1, "\u203B \u4E0A\u4F4D\u306E\u8272\u4ED8\u304D\u304C\u6C7A\u52DD\u30C8\u30FC\u30CA\u30E1\u30F3\u30C8\u9032\u51FA\u3002\u9806\u4F4D\u306F \u52DD\u6570 \u2192 \u76F4\u63A5\u5BFE\u6C7A \u2192 \u30BB\u30C3\u30C8\u7387 \u306E\u9806\u3067\u6C7A\u3081\u307E\u3059\u3002\u3059\u3079\u3066\u4E26\u3093\u3060\u7D44\u306F\u300C\u3058\u3083\u3093\u3051\u3093\u300D\u6B04\u304C\u9EC4\u8272\u304F\u306A\u308B\u306E\u3067\u3001\u5165\u529B\u7528\u30BF\u30D6\u306E\u4E0B\u90E8\u306B\u3042\u308B\u300C\u3058\u3083\u3093\u3051\u3093\u300D\u6B04\u306B\u3001\u4EE3\u8868\u8005\u306E\u3058\u3083\u3093\u3051\u3093\u3067\u6C7A\u3081\u305F\u9806\u4F4D\uFF081\u304C\u52DD\u3061\uFF09\u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044\u3002", { role: "note" });
    g.merge(row, 1, row, 6);
    return row + 2;
  }

  // core/theme.js
  var THEME = {
    font: "Hiragino Sans",
    colors: {
      grid: "#9CA3AF",
      // 細い格子罫線
      line: "#202124",
      // ブラケットの枝線（格子より濃くして経路を目立たせる）
      accent: "#1F4E79",
      // 見出しの文字・強調罫線
      headerFill: "#4472C4",
      // 表ヘッダの帯
      headerText: "#FFFFFF",
      sectionFill: "#DCE6F1",
      // セクション見出しの地
      teamFill: "#DEEBF7",
      // チーム名セルの地
      inputFill: "#FFF2CC",
      // 入力欄（黄）
      doneFill: "#E2F0D9",
      // 入力済み（緑）
      muted: "#6B7280",
      // 補足テキスト
      text: "#000000",
      white: "#FFFFFF"
    },
    sizes: { title: 14, section: 12, body: 11, header: 10, note: 9 }
  };
  function toRgb(hex) {
    const h = hex.replace("#", "");
    const at = (i) => Math.round(parseInt(h.slice(i, i + 2), 16) / 255 * 1e4) / 1e4;
    return { red: at(0), green: at(2), blue: at(4) };
  }
  var ROLES = {
    title: { size: "title", bold: true },
    note: { size: "note", color: "muted" },
    section: { size: "section", bold: true, color: "accent", fill: "sectionFill" },
    tableHeader: { size: "header", bold: true, color: "white", fill: "headerFill", box: true, align: "CENTER" },
    team: { size: "body", bold: true, fill: "teamFill", box: true, align: "CENTER" },
    slot: { size: "body", box: true, align: "CENTER" },
    // TEXT書式は必須。無いと "2-1" が日付として解釈され、勝敗判定の文字列比較が黙って外れる。
    input: { size: "body", bold: true, fill: "inputFill", box: true, align: "CENTER", text: true },
    body: { size: "body", box: true },
    label: { size: "body", bold: true, box: true, align: "CENTER" },
    // 平常時は白。同着が起きたときだけ条件付き書式で黄色くする。
    // 常時黄色だと「入力必須」に見えてしまう。
    optional: { size: "body", bold: true, box: true, align: "CENTER", text: true },
    // シード印。チーム名の文字列に足すと勝ち上がり判定の文字列比較が外れるので、左隣に置く。
    seed: { size: "body", bold: true, color: "accent", align: "CENTER" }
  };

  // core/palette.js
  var COLORS = {
    line: "#202124",
    // ブラケットの枝
    header: "#F1F3F4",
    winner: "#D93025",
    // 勝ち上がり経路の線（連結列を塗る）
    winnerBox: "#FCE8E6",
    // 経路上のチーム枠の地。線より淡くしないと箱が潰れて帯に見える
    winnerText: "#B31412",
    // 経路上のチーム名。淡い地に白文字は読めないので濃い赤にする
    loser: "#9AA0A6",
    resultPending: "#FFF2CC",
    // 未入力の結果セル（黄）
    resultDone: "#E2F0D9",
    // 入力済みの結果セル（緑）
    advance: "#D9EAD3"
    // 予選通過ラインの行。入力済みの緑より一段濃くして区別する
  };

  // core/formatting.js
  var WINNER_FORMAT = {
    backgroundColor: toRgb(COLORS.winner),
    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
  };
  var PATH_FORMAT = WINNER_FORMAT;
  var DONE_FORMAT = { backgroundColor: toRgb(COLORS.resultDone) };
  var ADVANCE_FORMAT = {
    backgroundColor: toRgb(COLORS.advance),
    textFormat: { bold: true }
  };
  function colName(n) {
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }
  var oneCell = (sheetId, row, col2) => ({
    sheetId,
    startRowIndex: row - 1,
    endRowIndex: row,
    startColumnIndex: col2 - 1,
    endColumnIndex: col2
  });
  var rule = (ranges, condition, format) => ({
    addConditionalFormatRule: { rule: { ranges, booleanRule: { condition, format } }, index: 0 }
  });
  var customFormula = (f) => ({ type: "CUSTOM_FORMULA", values: [{ userEnteredValue: f }] });
  function buildConditionalFormatRules(tournament, grids, sheetIds) {
    var _a, _b, _c, _d, _e;
    const out = [];
    for (const cell of grids.bracket.cells.values()) {
      const { winnerOf, championOf } = (_a = cell.style) != null ? _a : {};
      const range = oneCell(sheetIds.bracket, cell.row, cell.col);
      const self = a1(cell.row, cell.col).replace(/^([A-Z]+)(\d+)$/, "$$$1$$$2");
      if ((_b = cell.style) == null ? void 0 : _b.helper) continue;
      if (winnerOf) {
        const w = helperCell(tournament, winnerOf, "winner");
        out.push(rule([range], customFormula(`=AND(${w}<>"",${self}=${w})`), WINNER_FORMAT));
      } else if (championOf) {
        const w = helperCell(tournament, championOf, "winner");
        out.push(rule([range], customFormula(`=${w}<>""`), WINNER_FORMAT));
      }
    }
    for (const p of (_c = grids.bracket.paths) != null ? _c : []) {
      const w = helperCell(tournament, p.winnerOf, "winner");
      out.push(
        rule(
          [{
            sheetId: sheetIds.bracket,
            startRowIndex: p.r1 - 1,
            endRowIndex: p.r2,
            startColumnIndex: p.col - 1,
            endColumnIndex: p.col
          }],
          customFormula(`=AND(${w}<>"",${p.cellRef}=${w})`),
          PATH_FORMAT
        )
      );
    }
    for (const a of (_d = grids.bracket.advances) != null ? _d : []) {
      out.push(
        rule(
          [{
            sheetId: sheetIds.bracket,
            startRowIndex: a.r1 - 1,
            endRowIndex: a.r2,
            startColumnIndex: a.c1 - 1,
            endColumnIndex: a.c2
          }],
          customFormula(`=AND($${colName(a.rankCol)}${a.r1}<>"",$${colName(a.rankCol)}${a.r1}<=${a.cutoff})`),
          ADVANCE_FORMAT
        )
      );
    }
    for (const [key, grid] of [["bracket", grids.bracket], ["mobile", grids.mobile]]) {
      for (const cell of grid.cells.values()) {
        if (!((_e = cell.style) == null ? void 0 : _e.jankenOf)) continue;
        out.push(
          rule(
            [{
              sheetId: sheetIds[key],
              startRowIndex: cell.row - 1,
              endRowIndex: cell.row,
              startColumnIndex: cell.col - 1,
              endColumnIndex: cell.col
            }],
            // a1() は行番号を含むので、列名だけを取り出す。
            customFormula(`=$${colName(cell.col + 1)}$${cell.row}<>""`),
            { backgroundColor: toRgb(COLORS.resultPending), textFormat: { bold: true } }
          )
        );
      }
    }
    const n = tournament.matches.length;
    const mobileStart = 5;
    out.push(
      rule(
        [{ sheetId: sheetIds.mobile, startRowIndex: mobileStart - 1, endRowIndex: mobileStart - 1 + n, startColumnIndex: 2, endColumnIndex: 3 }],
        { type: "NOT_BLANK" },
        DONE_FORMAT
      )
    );
    out.push(
      rule(
        [{ sheetId: sheetIds.mobile, startRowIndex: mobileStart - 1, endRowIndex: mobileStart - 1 + n, startColumnIndex: 3, endColumnIndex: 4 }],
        { type: "NOT_BLANK" },
        WINNER_FORMAT
      )
    );
    const pg = grids.progress;
    const winnerRows = [...pg.cells.values()].filter((c) => c.col === 6 && String(c.value).startsWith("="));
    if (winnerRows.length) {
      const r1 = Math.min(...winnerRows.map((c) => c.row));
      const r2 = Math.max(...winnerRows.map((c) => c.row));
      out.push(
        rule(
          [{ sheetId: sheetIds.progress, startRowIndex: r1 - 1, endRowIndex: r2, startColumnIndex: 5, endColumnIndex: 6 }],
          { type: "NOT_BLANK" },
          WINNER_FORMAT
        )
      );
    }
    return out;
  }

  // core/payload.js
  function buildSpreadsheetPayload(tournament) {
    const sheets = [
      { sheetId: 0, title: TABS.bracket, grid: layoutBracketSheet(tournament), hidden: false },
      { sheetId: 1, title: TABS.progress, grid: layoutProgressSheet(tournament), hidden: false },
      { sheetId: 2, title: TABS.mobile, grid: layoutMobileSheet(tournament), hidden: false },
      { sheetId: 3, title: TABS.control, grid: layoutControlSheet(tournament), hidden: true }
    ];
    const create = {
      properties: { title: tournament.title || `\u30C8\u30FC\u30CA\u30E1\u30F3\u30C8\uFF08${tournament.teams}\u30C1\u30FC\u30E0\uFF09` },
      sheets: sheets.map(({ sheetId, title, grid, hidden }) => ({
        properties: {
          sheetId,
          title,
          hidden,
          gridProperties: {
            rowCount: Math.max(grid.maxRow + 5, 20),
            columnCount: Math.max(grid.maxCol + 2, 8)
          }
        }
      }))
    };
    const requests = [];
    for (const { sheetId, grid } of sheets) {
      requests.push(updateCellsRequest(sheetId, grid));
      requests.push(commonFormatRequest(sheetId, grid));
      requests.push(...roleFormatRequests(sheetId, grid));
      requests.push(...boxBorderRequests(sheetId, grid));
      for (const [col2, width] of grid.columns) {
        requests.push({
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS", startIndex: col2 - 1, endIndex: col2 },
            properties: { pixelSize: Math.round(width * 7.5) },
            fields: "pixelSize"
          }
        });
      }
      if (grid.frozenRows) {
        requests.push({
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: grid.frozenRows } },
            fields: "gridProperties.frozenRowCount"
          }
        });
      }
      for (const b of grid.borders) {
        requests.push({
          updateBorders: {
            range: {
              sheetId,
              startRowIndex: b.r1 - 1,
              endRowIndex: b.r2,
              startColumnIndex: b.c1 - 1,
              endColumnIndex: b.c2
            },
            [b.side]: { style: "SOLID", color: toRgb(COLORS.line) }
          }
        });
      }
      for (const m of grid.merges) {
        requests.push({
          mergeCells: {
            range: { sheetId, startRowIndex: m.r1 - 1, endRowIndex: m.r2, startColumnIndex: m.c1 - 1, endColumnIndex: m.c2 },
            mergeType: "MERGE_ALL"
          }
        });
      }
      requests.push(...validationRequests(sheetId, grid));
    }
    const hc = helperCols(tournament);
    for (const col2 of [hc.winner, hc.loser]) {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId: 0, dimension: "COLUMNS", startIndex: col2 - 1, endIndex: col2 },
          properties: { hiddenByUser: true },
          fields: "hiddenByUser"
        }
      });
    }
    requests.push(
      ...buildConditionalFormatRules(
        tournament,
        { bracket: sheets[0].grid, progress: sheets[1].grid, mobile: sheets[2].grid },
        { bracket: 0, progress: 1, mobile: 2, control: 3 }
      )
    );
    return { create, requests, sheets: sheets.map(({ sheetId, title }) => ({ sheetId, title })) };
  }
  function updateCellsRequest(sheetId, grid) {
    const rows = [];
    for (let r = 1; r <= grid.maxRow; r++) {
      const values = [];
      for (let c = 1; c <= grid.maxCol; c++) {
        values.push(cellData(grid.cells.get(`${r},${c}`)));
      }
      rows.push({ values });
    }
    return {
      updateCells: {
        range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endRowIndex: grid.maxRow, endColumnIndex: grid.maxCol },
        rows,
        fields: "userEnteredValue"
      }
    };
  }
  function cellData(cell) {
    if (!cell) return {};
    const v = cell.value;
    if (v === "" || v == null) return {};
    return {
      userEnteredValue: String(v).startsWith("=") ? { formulaValue: String(v) } : { stringValue: String(v) }
    };
  }
  function roleFormatRequests(sheetId, grid) {
    var _a, _b, _c;
    const byRole = /* @__PURE__ */ new Map();
    for (const c of grid.cells.values()) {
      const r = (_a = c.style) == null ? void 0 : _a.role;
      if (!r || !ROLES[r]) continue;
      if (!byRole.has(r)) byRole.set(r, /* @__PURE__ */ new Set());
      byRole.get(r).add(`${c.row},${c.col}`);
    }
    const out = [];
    for (const [roleName, cells] of byRole) {
      const role = ROLES[roleName];
      const fmt = {};
      const text = {};
      if (role.bold) text.bold = true;
      if (role.size) text.fontSize = THEME.sizes[role.size];
      if (role.color) text.foregroundColor = toRgb(THEME.colors[role.color]);
      if (Object.keys(text).length) fmt.textFormat = text;
      fmt.backgroundColor = toRgb(THEME.colors[(_b = role.fill) != null ? _b : "white"]);
      fmt.horizontalAlignment = (_c = role.align) != null ? _c : "LEFT";
      if (role.text) fmt.numberFormat = { type: "TEXT" };
      const fields = [
        "userEnteredFormat.backgroundColor",
        "userEnteredFormat.horizontalAlignment",
        "userEnteredFormat.textFormat.bold",
        "userEnteredFormat.textFormat.fontSize",
        "userEnteredFormat.textFormat.foregroundColor",
        ...role.text ? ["userEnteredFormat.numberFormat"] : []
      ].join(",");
      for (const box of rectangles(cells)) {
        out.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: box.r0 - 1,
              endRowIndex: box.r1,
              startColumnIndex: box.c0 - 1,
              endColumnIndex: box.c1
            },
            cell: { userEnteredFormat: fmt },
            fields
          }
        });
      }
    }
    return out;
  }
  function rectangles(cells) {
    const has = (r, c) => cells.has(`${r},${c}`);
    const taken = /* @__PURE__ */ new Set();
    const out = [];
    const sorted = [...cells].map((k) => k.split(",").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const [r0, c0] of sorted) {
      if (taken.has(`${r0},${c0}`)) continue;
      let c1 = c0;
      while (has(r0, c1 + 1) && !taken.has(`${r0},${c1 + 1}`)) c1 += 1;
      let r1 = r0;
      for (; ; ) {
        const nr = r1 + 1;
        let ok = true;
        for (let c = c0; c <= c1; c++) {
          if (!has(nr, c) || taken.has(`${nr},${c}`)) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
        r1 = nr;
      }
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) taken.add(`${r},${c}`);
      out.push({ r0, c0, r1, c1 });
    }
    return out;
  }
  function commonFormatRequest(sheetId, grid) {
    return {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: grid.maxRow, startColumnIndex: 0, endColumnIndex: grid.maxCol },
        cell: { userEnteredFormat: { textFormat: { fontFamily: THEME.font }, verticalAlignment: "MIDDLE" } },
        fields: "userEnteredFormat.textFormat.fontFamily,userEnteredFormat.verticalAlignment"
      }
    };
  }
  function boxBorderRequests(sheetId, grid) {
    var _a, _b;
    const boxed = /* @__PURE__ */ new Set();
    for (const c of grid.cells.values()) {
      if ((_b = ROLES[(_a = c.style) == null ? void 0 : _a.role]) == null ? void 0 : _b.box) boxed.add(`${c.row},${c.col}`);
    }
    const line = { style: "SOLID", color: toRgb(THEME.colors.grid) };
    return rectangles(boxed).map((b) => ({
      updateBorders: {
        range: {
          sheetId,
          startRowIndex: b.r0 - 1,
          endRowIndex: b.r1,
          startColumnIndex: b.c0 - 1,
          endColumnIndex: b.c1
        },
        top: line,
        bottom: line,
        left: line,
        right: line,
        // 内側罫線は範囲が2セル以上あるときだけ意味がある
        ...b.c1 > b.c0 ? { innerVertical: line } : {},
        ...b.r1 > b.r0 ? { innerHorizontal: line } : {}
      }
    }));
  }
  function validationRequests(sheetId, grid) {
    var _a;
    const out = [];
    for (const cell of grid.cells.values()) {
      const opts = (_a = cell.style) == null ? void 0 : _a.validation;
      if (!opts) continue;
      out.push({
        setDataValidation: {
          range: {
            sheetId,
            startRowIndex: cell.row - 1,
            endRowIndex: cell.row,
            startColumnIndex: cell.col - 1,
            endColumnIndex: cell.col
          },
          rule: {
            condition: { type: "ONE_OF_LIST", values: opts.map((v) => ({ userEnteredValue: v })) },
            strict: true,
            showCustomUi: true
          }
        }
      });
    }
    return out;
  }
  return __toCommonJS(bundle_entry_exports);
})();
