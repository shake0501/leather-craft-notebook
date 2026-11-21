// 革しごと手帖 — お気に入り・マイメモ・計算ツール
(() => {
  "use strict";

  const STORE_KEY = "leather-notebook-v1";

  // ---------- 保存（このブラウザの localStorage） ----------
  const load = () => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return { favorites: data.favorites || [], notes: data.notes || [] };
    } catch {
      return { favorites: [], notes: [] };
    }
  };
  let state = load();
  const save = () => {
    try {
      // 再生中・削除確認などの一時的な状態は保存しない
      const strip = (list) => list.map(({ playing, confirm, ...rest }) => rest);
      localStorage.setItem(STORE_KEY, JSON.stringify({ favorites: strip(state.favorites), notes: strip(state.notes) }));
      return true;
    } catch {
      return false;
    }
  };

  const $ = (sel) => document.querySelector(sel);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- ポンチ号数 ----------
  const MM_PER_GOU = 0.3;
  const toGou = (mm) => Math.round(mm / MM_PER_GOU);

  const quickInput = $("#mmInput");
  const quickOut = $("#mmResult");
  const updateQuick = () => {
    const mm = parseFloat(quickInput.value);
    if (!(mm > 0)) { quickOut.textContent = "—"; return; }
    const g = toGou(mm);
    const exact = (g * MM_PER_GOU).toFixed(1);
    quickOut.textContent = `${g}号` + (Math.abs(g * MM_PER_GOU - mm) > 0.05 ? `（${exact}mm）` : "");
    document.querySelectorAll("#punchTable tbody tr").forEach((tr) => {
      tr.classList.toggle("is-hit", Number(tr.dataset.gou) === g);
    });
  };

  const PUNCH_USES = {
    1: "糸の通し穴の目印",
    2: "細い糸・ビーズ",
    3: "",
    4: "",
    5: "細い革ひも",
    6: "極小カシメ",
    7: "",
    8: "小カシメ・バネホック小",
    9: "",
    10: "中カシメ・ベルト小穴",
    12: "大カシメ・バネホック中",
    13: "ハトメ #200 の目安",
    15: "特大カシメ・ベルト穴",
    17: "ハトメ #300 の目安",
    18: "ベルト穴・ジャンパーホック",
    20: "ベルト穴（太め）",
    25: "大きめの紐通し",
    30: "大ハトメ・ストラップ穴",
    40: "",
    50: "",
  };
  const renderPunchTable = () => {
    const tbody = $("#punchTable tbody");
    const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 15, 17, 18, 20, 25, 30, 40, 50];
    // 1mm = 4px で丸の大きさを表示（50号=15mm でも 60px に収まる）
    tbody.innerHTML = list
      .map((g) => {
        const mm = (g * MM_PER_GOU).toFixed(1);
        const px = Math.max(2, g * MM_PER_GOU * 4);
        return `<tr data-gou="${g}">
          <td><b>${g}号</b></td>
          <td class="num">${mm}mm</td>
          <td><span class="hole-cell" style="height:${Math.max(32, px + 8)}px"><span class="hole" style="width:${px}px;height:${px}px"></span></span></td>
          <td>${esc(PUNCH_USES[g] || "")}</td>
        </tr>`;
      })
      .join("");
  };

  // ---------- カシメ足の長さ ----------
  const RIVET_LEGS = [4, 5, 6, 7, 8, 9, 10, 12, 14, 16];
  const updateRivet = () => {
    const a = parseFloat($("#leatherA").value) || 0;
    const b = parseFloat($("#leatherB").value) || 0;
    const total = a + b;
    const out = $("#rivetResult");
    if (total <= 0) { out.textContent = "革の厚みを入れてください。"; return; }
    const min = total + 1, max = total + 2;
    const pick = RIVET_LEGS.find((l) => l >= min) ?? RIVET_LEGS[RIVET_LEGS.length - 1];
    out.innerHTML = `合計 <strong>${total.toFixed(1)}mm</strong> → 足の長さ <strong>${min.toFixed(1)}〜${max.toFixed(1)}mm</strong> が目安。一般的な規格なら <strong>${pick}mm</strong> 前後を選びます。`;
  };

  // ---------- URL の解析 ----------
  const extractUrl = (input) => {
    const s = input.trim();
    const m = s.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
    return m ? m[1] : s;
  };
  const parseMedia = (rawUrl) => {
    let url;
    try { url = new URL(rawUrl.startsWith("//") ? "https:" + rawUrl : rawUrl); }
    catch { return null; }
    if (!/^https?:$/.test(url.protocol)) return null;
    const host = url.hostname.replace(/^www\.|^m\./, "");

    // YouTube（通常・短縮・ショート・ライブ・埋め込み）
    let yt = null;
    if (host === "youtu.be") yt = url.pathname.slice(1).split("/")[0];
    else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
      yt = url.searchParams.get("v");
      const p = url.pathname.match(/^\/(?:shorts|live|embed|v)\/([\w-]{6,})/);
      if (!yt && p) yt = p[1];
    }
    // YouTube 再生リスト（動画IDなしで list= だけのURL）
    const list = /(^|\.)youtube(-nocookie)?\.com$/.test(host) ? url.searchParams.get("list") : null;
    if (!yt && list && /^[\w-]{10,}$/.test(list)) {
      return { kind: "ytlist", id: list, url: `https://www.youtube.com/playlist?list=${list}`, host: "youtube.com" };
    }
    if (yt && /^[\w-]{6,}$/.test(yt)) {
      const t = url.searchParams.get("t") || url.searchParams.get("start");
      const start = t ? parseInt(String(t).replace(/s$/, ""), 10) || 0 : 0;
      return { kind: "youtube", id: yt, start, url: `https://www.youtube.com/watch?v=${yt}${start ? `&t=${start}s` : ""}`, host: "youtube.com" };
    }
    // Vimeo
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const v = url.pathname.match(/(\d{5,})/);
      if (v) return { kind: "vimeo", id: v[1], url: `https://vimeo.com/${v[1]}`, host: "vimeo.com" };
    }
    return { kind: "site", url: url.href, host };
  };

  const embedSrc = (f) => {
    if (f.kind === "youtube") return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(f.id)}?autoplay=1&rel=0${f.start ? `&start=${f.start}` : ""}`;
    if (f.kind === "ytlist") return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(f.id)}&autoplay=1&rel=0`;
    if (f.kind === "vimeo") return `https://player.vimeo.com/video/${encodeURIComponent(f.id)}?autoplay=1`;
    return f.url;
  };

  // ---------- お気に入り ----------
  let tagFilter = "すべて";
  let favQuery = "";
  const openPreview = new Set();
  const editing = new Set();

  const allTags = () => [...new Set(state.favorites.map((f) => f.tag).filter(Boolean))];

  const renderTags = () => {
    const tags = allTags();
    if (tagFilter !== "すべて" && !tags.includes(tagFilter)) tagFilter = "すべて";
    $("#tagFilter").innerHTML = ["すべて", ...tags]
      .map((t) => `<button type="button" class="chip${t === tagFilter ? " is-on" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`)
      .join("");
    $("#tagList").innerHTML = tags.map((t) => `<option value="${esc(t)}"></option>`).join("");
  };

  const favCard = (f) => {
    const title = f.title || (f.kind === "site" ? f.host : "動画");
    let media = "";
    if (f.kind === "youtube" || f.kind === "vimeo" || f.kind === "ytlist") {
      if (f.playing) {
        media = `<div class="fav-media"><iframe src="${esc(embedSrc(f))}" title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" loading="lazy"></iframe></div>`;
      } else {
        const thumb = f.kind === "youtube" ? `https://i.ytimg.com/vi/${encodeURIComponent(f.id)}/hqdefault.jpg` : "";
        media = `<div class="fav-media"><button type="button" class="fav-thumb${f.kind === "ytlist" ? " is-list" : ""}" data-act="play" data-id="${f.id_}" aria-label="${esc(title)} を再生" style="${thumb ? `background-image:url('${thumb}')` : ""}"></button></div>`;
      }
    } else {
      media = `<div class="fav-site">
          <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(f.host)}&sz=64" alt="" loading="lazy">
          <span class="fav-host">${esc(f.host)}</span>
        </div>`;
      if (openPreview.has(f.id_)) {
        media += `<div class="fav-preview"><iframe src="${esc(f.url)}" title="${esc(title)} のプレビュー" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups"></iframe></div>`;
      }
    }

    const edit = editing.has(f.id_)
      ? `<form class="fav-edit" data-id="${f.id_}">
          <input type="text" name="title" value="${esc(f.title)}" placeholder="タイトル" aria-label="タイトル">
          <input type="text" name="tag" value="${esc(f.tag)}" placeholder="カテゴリ" list="tagList" aria-label="カテゴリ">
          <input type="text" name="memo" value="${esc(f.memo)}" placeholder="メモ" aria-label="メモ">
          <div class="fav-actions"><button class="btn small primary" type="submit">保存</button><button class="btn small" type="button" data-act="cancel" data-id="${f.id_}">やめる</button></div>
        </form>`
      : "";

    const confirmDel = f.confirm
      ? `<span class="fav-memo">削除しますか？</span><button class="btn small primary" type="button" data-act="del-yes" data-id="${f.id_}">削除する</button><button class="btn small" type="button" data-act="del-no" data-id="${f.id_}">やめる</button>`
      : `${f.kind === "site" ? `<button class="btn small ghost" type="button" data-act="preview" data-id="${f.id_}">${openPreview.has(f.id_) ? "プレビューを閉じる" : "埋め込みで見る"}</button>` : ""}
         <button class="btn small ghost" type="button" data-act="edit" data-id="${f.id_}">編集</button>
         <button class="btn small ghost" type="button" data-act="del" data-id="${f.id_}">削除</button>`;

    return `<article class="fav">
      ${media}
      <div class="fav-body">
        <p class="fav-title"><a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a></p>
        ${f.memo ? `<p class="fav-memo">${esc(f.memo)}</p>` : ""}
        ${openPreview.has(f.id_) ? `<p class="fav-memo">真っ白・エラーになる場合は、そのサイトが埋め込みを禁止しています。タイトルから開いてください。</p>` : ""}
        <div class="fav-meta">
          ${f.tag ? `<span class="tag">${esc(f.tag)}</span>` : "<span></span>"}
          <div class="fav-actions">${confirmDel}</div>
        </div>
      </div>
      ${edit}
    </article>`;
  };

  const renderFavs = () => {
    renderTags();
    const q = favQuery.trim().toLowerCase();
    const list = state.favorites.filter((f) => {
      if (tagFilter !== "すべて" && f.tag !== tagFilter) return false;
      if (!q) return true;
      return [f.title, f.memo, f.tag, f.url, f.host].join(" ").toLowerCase().includes(q);
    });
    $("#favList").innerHTML = list.map(favCard).join("");
    const empty = $("#favEmpty");
    empty.hidden = list.length > 0;
    if (!list.length && state.favorites.length) {
      empty.innerHTML = `<p class="empty-title">条件に合うものがありません</p><p>カテゴリやキーワードを変えてみてください。</p>`;
    } else if (!state.favorites.length) {
      empty.innerHTML = `<p class="empty-title">まだ登録がありません</p><p>上のフォームに、よく見るYouTube動画やブログのURLを貼って「登録する」を押してください。</p>`;
    }
  };

  const favMsg = (text, isError = false) => {
    const el = $("#favMsg");
    el.textContent = text;
    el.classList.toggle("is-error", isError);
  };

  $("#favForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = extractUrl($("#favUrl").value);
    const media = parseMedia(raw.match(/^https?:\/\//i) || raw.startsWith("//") ? raw : "https://" + raw);
    if (!media) { favMsg("URLを読み取れませんでした。https:// から始まるURLを貼ってください。", true); return; }
    if (state.favorites.some((f) => f.url === media.url)) { favMsg("このURLはもう登録されています。", true); return; }
    state.favorites.unshift({
      id_: uid(),
      ...media,
      title: $("#favTitle").value.trim(),
      tag: $("#favTag").value.trim(),
      memo: $("#favMemo").value.trim(),
      added: new Date().toISOString(),
    });
    const ok = save();
    e.target.reset();
    favMsg(ok ? `登録しました（${media.kind === "site" ? "サイト" : "動画"}）` : "登録しましたが、このブラウザでは保存できませんでした。書き出しで控えを取ってください。", !ok);
    renderFavs();
  });

  $("#favList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const f = state.favorites.find((x) => x.id_ === btn.dataset.id);
    if (!f) return;
    switch (btn.dataset.act) {
      case "play": f.playing = true; break; // 再生状態は保存しない
      case "preview": openPreview.has(f.id_) ? openPreview.delete(f.id_) : openPreview.add(f.id_); break;
      case "edit": editing.add(f.id_); break;
      case "cancel": editing.delete(f.id_); break;
      case "del": f.confirm = true; break;
      case "del-no": f.confirm = false; break;
      case "del-yes":
        state.favorites = state.favorites.filter((x) => x !== f);
        save();
        break;
    }
    renderFavs();
  });

  $("#favList").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target.closest(".fav-edit");
    const f = state.favorites.find((x) => x.id_ === form.dataset.id);
    if (!f) return;
    f.title = form.title.value.trim();
    f.tag = form.tag.value.trim();
    f.memo = form.memo.value.trim();
    editing.delete(f.id_);
    save();
    renderFavs();
  });

  $("#tagFilter").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-tag]");
    if (!chip) return;
    tagFilter = chip.dataset.tag;
    renderFavs();
  });
  $("#favSearch").addEventListener("input", (e) => { favQuery = e.target.value; renderFavs(); });

  // ---------- マイメモ ----------
  let noteFilter = "all";
  const noteEditing = new Set();

  const renderNotes = () => {
    const list = state.notes.filter((n) => noteFilter === "all" || (noteFilter === "done" ? n.done : !n.done));
    $("#noteList").innerHTML = list
      .map((n) => {
        if (noteEditing.has(n.id_)) {
          return `<form class="memo-item" data-id="${n.id_}">
            <input type="text" name="q" value="${esc(n.q)}" aria-label="わからないこと" required>
            <textarea name="a" rows="3" aria-label="答え">${esc(n.a)}</textarea>
            <div class="fav-actions"><button class="btn small primary" type="submit">保存</button><button class="btn small" type="button" data-act="cancel" data-id="${n.id_}">やめる</button></div>
          </form>`;
        }
        return `<article class="memo-item${n.done ? " is-done" : ""}">
          <p class="note-q">Q. ${esc(n.q)}</p>
          <p class="note-a${n.a ? "" : " is-empty"}">${n.a ? esc(n.a) : "まだ答えがありません"}</p>
          <div class="note-foot">
            <span class="state">${n.done ? "解決済み" : "未解決"}</span>
            <div class="fav-actions">
              ${n.confirm
                ? `<span class="fav-memo">削除しますか？</span><button class="btn small primary" type="button" data-act="del-yes" data-id="${n.id_}">削除する</button><button class="btn small" type="button" data-act="del-no" data-id="${n.id_}">やめる</button>`
                : `<button class="btn small ghost" type="button" data-act="toggle" data-id="${n.id_}">${n.done ? "未解決に戻す" : "解決した"}</button>
                   <button class="btn small ghost" type="button" data-act="edit" data-id="${n.id_}">編集</button>
                   <button class="btn small ghost" type="button" data-act="del" data-id="${n.id_}">削除</button>`}
            </div>
          </div>
        </article>`;
      })
      .join("");
    const empty = $("#noteEmpty");
    empty.hidden = list.length > 0;
  };

  $("#noteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#noteQ").value.trim();
    if (!q) return;
    const a = $("#noteA").value.trim();
    state.notes.unshift({ id_: uid(), q, a, done: !!a, added: new Date().toISOString() });
    save();
    e.target.reset();
    renderNotes();
  });

  $("#noteList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const n = state.notes.find((x) => x.id_ === btn.dataset.id);
    if (!n) return;
    switch (btn.dataset.act) {
      case "toggle": n.done = !n.done; save(); break;
      case "edit": noteEditing.add(n.id_); break;
      case "cancel": noteEditing.delete(n.id_); break;
      case "del": n.confirm = true; break;
      case "del-no": n.confirm = false; break;
      case "del-yes": state.notes = state.notes.filter((x) => x !== n); save(); break;
    }
    renderNotes();
  });

  $("#noteList").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const n = state.notes.find((x) => x.id_ === form.dataset.id);
    if (!n) return;
    n.q = form.q.value.trim() || n.q;
    n.a = form.a.value.trim();
    if (n.a) n.done = true;
    noteEditing.delete(n.id_);
    save();
    renderNotes();
  });

  $("#noteFilter").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-f]");
    if (!chip) return;
    noteFilter = chip.dataset.f;
    document.querySelectorAll("#noteFilter .chip").forEach((c) => c.classList.toggle("is-on", c === chip));
    renderNotes();
  });

  // ---------- 書き出し・読み込み ----------
  const clean = (list) => list.map(({ playing, confirm, ...rest }) => rest);

  $("#exportBtn").addEventListener("click", () => {
    const data = { app: "leather-notebook", version: 1, exported: new Date().toISOString(), favorites: clean(state.favorites), notes: clean(state.notes) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leather-notebook-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    $("#backupMsg").textContent = `書き出しました（お気に入り ${state.favorites.length}件・メモ ${state.notes.length}件）`;
  });

  $("#importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const msg = $("#backupMsg");
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.favorites) && !Array.isArray(data.notes)) throw new Error("format");
      // 既存データに追加（同じURL・同じ質問は重複させない）
      const favUrls = new Set(state.favorites.map((f) => f.url));
      const addFav = (data.favorites || []).filter((f) => f && f.url && !favUrls.has(f.url)).map((f) => ({ ...f, id_: f.id_ || uid() }));
      const noteQs = new Set(state.notes.map((n) => n.q));
      const addNote = (data.notes || []).filter((n) => n && n.q && !noteQs.has(n.q)).map((n) => ({ ...n, id_: n.id_ || uid() }));
      state.favorites = [...addFav, ...state.favorites];
      state.notes = [...addNote, ...state.notes];
      save();
      renderFavs();
      renderNotes();
      msg.textContent = `読み込みました（お気に入り ${addFav.length}件・メモ ${addNote.length}件を追加）`;
    } catch {
      msg.textContent = "読み込めませんでした。このサイトで書き出したファイルを選んでください。";
    }
    e.target.value = "";
  });

  // ---------- レザークラフトCAD ショートカット ----------
  // 出典: Leathercraft CAD 公式サイト（紹介ページ・ショートカットキー一覧, v4.2.3 時点）
  const CAD_KEYS = [
    ["ツール", "A", "選択", "図形を選ぶ。Shift / Ctrl+クリックで追加選択"],
    ["ツール", "D", "点", "点を置く"],
    ["ツール", "L", "直線", "Shift で水平・垂直に拘束"],
    ["ツール", "R", "四角", "ドラッグ後 Enter で幅・高さを数値入力"],
    ["ツール", "E", "円", "正円を描く"],
    ["ツール", "Shift+E", "楕円", "楕円を描く"],
    ["ツール", "V", "円弧", "円弧を描く。角度はステータスバーに表示"],
    ["ツール", "B", "ベジエ曲線", "制御点で何度でも形を直せる"],
    ["ツール", "T", "テキスト", "文字を入れる。F2 で編集"],
    ["ツール", "P", "目打ち（縫い穴）", "菱目・ヨーロッパ目打ち・丸目・平目。手動／自動、固定ピッチ／可変ピッチ"],
    ["ツール", "O", "オフセット（複線）", "外形から指定距離ずらした線。ステッチラインづくりに"],
    ["ツール", "X", "面取り", "角を丸める。複数の角をまとめて処理できる"],
    ["ツール", "C", "中心線", "2点の中心に線を引く"],
    ["ツール", "M", "目印線", "指定した距離に印を付ける"],
    ["ツール", "#", "寸法線", "長さを図面に記入"],
    ["ツール", "!", "トリミング", "交点で線を切る"],
    ["ツール", "Z", "延長／トリム", "選んだ2本の直線を交点まで延長、またははみ出しを切る"],
    ["ツール", "W", "透かし（トレース）", "画像やPDFを下絵として読み込む"],
    ["ツール", "Y", "テンプレート", "お札・カード・コインなどの形を呼び出す（パーツ倉庫）"],
    ["ツール", "S", "ものさし", "長さを測る（表示の切り替えにも使う）"],
    ["ツール", "U", "革シミュレーター", "革の質感で仕上がりを確認"],
    ["ツール", "Q", "曼荼羅モード", "放射状の模様づくり"],
    ["ファイル", "Ctrl+N", "新規作成", ""],
    ["ファイル", "Ctrl+O", "開く", ""],
    ["ファイル", "Ctrl+S", "保存", ".LCC 形式で保存"],
    ["ファイル", "Shift+Ctrl+S", "名前を付けて保存", ""],
    ["ファイル", "Ctrl+P", "印刷", "拡大縮小は「なし／100%」に"],
    ["編集", "Ctrl+Z", "元に戻す", ""],
    ["編集", "Shift+Ctrl+Z", "やり直す", ""],
    ["編集", "Ctrl+A", "すべて選択", ""],
    ["編集", "Ctrl+D", "選択解除", ""],
    ["編集", "Ctrl+C / X / V", "コピー／切り取り／貼り付け", ""],
    ["編集", "Shift+Ctrl+C", "距離を指定して移動・コピー", ""],
    ["編集", "Delete", "削除", "BackSpace でも可"],
    ["編集", "Ctrl+G / Ctrl+U", "グループ化／解除", ""],
    ["編集", "Ctrl+I / Ctrl+J", "左右反転／上下反転", ""],
    ["編集", "Ctrl+L", "線対称を作る", "左右対称の型紙に"],
    ["編集", "Ctrl+E", "共通接線・接円", ""],
    ["編集", "Ctrl+F", "描画方向を反転", ""],
    ["編集", "F8", "テンプレートを分解", ""],
    ["編集", "F9 / F10", "テンプレート化", "F10 は元の図形を残す"],
    ["移動・変形", "Ctrl+矢印", "1mm 移動", ""],
    ["移動・変形", "Ctrl+Shift+矢印", "0.1mm 移動", ""],
    ["移動・変形", "Ctrl+Alt+矢印", "0.01mm 移動", ""],
    ["移動・変形", "[ / ]", "1° 回転", "{ } で 5° 回転"],
    ["移動・変形", "Ctrl+[ / ]", "1% 拡大縮小", "Ctrl+Shift で 5%"],
    ["移動・変形", "Enter", "数値パレット", "長さ・角度・直径・半径を数値で指定"],
    ["表示", "G", "グリッド表示", "吸着がじゃまなときは非表示に"],
    ["表示", "I", "交点表示", ""],
    ["表示", "H", "透かしの表示切り替え", ""],
    ["表示", "F5", "寸法線の表示切り替え", ""],
    ["表示", "F6", "ステッチシミュレーション", ""],
    ["表示", "F7", "印刷範囲の表示", ""],
    ["表示", "Ctrl+R", "全体を表示", ""],
    ["表示", "矢印", "画面を動かす（パン）", ""],
    ["表示", "0〜9", "線パレットの切り替え", ""],
    ["レイヤー", "Ctrl+Alt+N", "レイヤーを追加", ""],
    ["レイヤー", "Ctrl+Alt+D", "レイヤーを削除", ""],
    ["レイヤー", "Ctrl+Alt+C", "レイヤー名を変更", ""],
    ["レイヤー", "Ctrl+Alt+U / J", "レイヤーを上へ／下へ", ""],
    ["レイヤー", "Ctrl+Alt+A", "他のレイヤーを隠す／全表示", ""],
    ["レイヤー", "Ctrl+Alt+M", "一つ下のレイヤーと統合", ""],
    ["レイヤー", "Ctrl+Alt+Y", "選択図形を一つ下のレイヤーへ", ""],
  ];
  let keyCat = "すべて";
  let keyQuery = "";
  const kbd = (combo) =>
    combo.split(" / ").map((part) =>
      part.split("+").map((k) => `<kbd>${esc(k)}</kbd>`).join("+")
    ).join(" / ");

  const renderKeys = () => {
    const cats = ["すべて", ...new Set(CAD_KEYS.map((k) => k[0]))];
    $("#keyFilter").innerHTML = cats
      .map((c) => `<button type="button" class="chip${c === keyCat ? " is-on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`)
      .join("");
    const q = keyQuery.trim().toLowerCase();
    const rows = CAD_KEYS.filter(([cat, key, name, desc]) =>
      (keyCat === "すべて" || cat === keyCat) &&
      (!q || [key, name, desc, cat].join(" ").toLowerCase().includes(q))
    );
    $("#keyTable").innerHTML = rows.length
      ? rows.map(([cat, key, name, desc]) =>
          `<tr><td>${kbd(key)}</td><td>${esc(name)}${keyCat === "すべて" ? `<span class="key-cat">${esc(cat)}</span>` : ""}</td><td>${esc(desc)}</td></tr>`
        ).join("")
      : `<tr><td colspan="3">「${esc(keyQuery)}」に当てはまる操作はありません。</td></tr>`;
    $("#keyCount").textContent = `${rows.length}件を表示中。Mac は Ctrl → ⌘、Alt → option に読み替え。`;
  };
  $("#keyFilter").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-cat]");
    if (!chip) return;
    keyCat = chip.dataset.cat;
    renderKeys();
  });
  $("#keySearch").addEventListener("input", (e) => { keyQuery = e.target.value; renderKeys(); });

  // 公式チュートリアル再生リストをお気に入りへ
  $("#addCadPlaylist").addEventListener("click", () => {
    const media = parseMedia("https://www.youtube.com/playlist?list=PL-8IKh6XA2LiQvDzb4yCiMRWd5LioeXVp");
    const msg = $("#cadMsg");
    if (state.favorites.some((f) => f.url === media.url)) {
      msg.textContent = "もうお気に入りに入っています。";
      return;
    }
    state.favorites.unshift({
      id_: uid(), ...media,
      title: "レザークラフトCAD 公式チュートリアル",
      tag: "レザークラフトCAD",
      memo: "Coffee and Craft 公式の再生リスト",
      added: new Date().toISOString(),
    });
    save();
    renderFavs();
    msg.innerHTML = `お気に入りに追加しました。<a href="#favorites">お気に入りで見る</a>`;
  });

  // ---------- 起動 ----------
  renderKeys();
  renderPunchTable();
  quickInput.addEventListener("input", updateQuick);
  ["#leatherA", "#leatherB"].forEach((s) => $(s).addEventListener("input", updateRivet));
  updateQuick();
  updateRivet();
  renderFavs();
  renderNotes();
})();
