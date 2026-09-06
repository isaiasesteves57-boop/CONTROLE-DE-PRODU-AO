/* =====================================================================
   CONTROLE DE PRODUÇÃO — Utilitários compartilhados (U)
   ===================================================================== */
(function () {
  const ICONS = {
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12h.01"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 0 1 4 0v.09c0 .68.4 1.3 1.03 1.56a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.29.6.9.97 1.56 1.03H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z"/>',
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 3.5"/>',
    sliders: '<path d="M4 21v-6M4 10V3M12 21v-9M12 8V3M20 21v-4M20 13V3"/><path d="M1.5 14h5M9.5 8h5M17.5 16h5"/>',
    lock: '<rect x="4.5" y="11" width="15" height="9.5" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
    trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    package: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v4M12 9v10M17 5v14"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5S20 17 20 21"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    speed: '<path d="M4 14a8 8 0 0 1 16 0"/><path d="M12 14l4-4"/>',
    box: '<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zM9 11h6M9 15h6"/>',
    flag: '<path d="M5 22V4"/><path d="M5 4h13l-2.5 4L18 12H5"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-8-5"/><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 8 5"/><path d="M3 3v6h6M21 21v-6h-6"/>',
    columns: '<rect x="4" y="4" width="7" height="16" rx="1.5"/><rect x="13" y="4" width="7" height="16" rx="1.5"/>',
    layers: '<path d="m12 2 10 6-10 6L2 8z"/><path d="m2 16 10 6 10-6"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pause: '<rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/>',
    power: '<path d="M12 3v9"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
    checkc: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/>'
  };

  function todayStr() {
    const d = new Date();
    const l = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return l.toISOString().slice(0, 10);
  }

  /* Diferença em horas entre dois horários "HH:MM" (suporta virada de dia) */
  function timeDiffHours(start, end) {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(":").map(Number);
    const [h2, m2] = end.split(":").map(Number);
    if (isNaN(h1) || isNaN(h2) || isNaN(m1) || isNaN(m2)) return 0;
    let mins = h2 * 60 + m2 - (h1 * 60 + m1);
    if (mins < 0) mins += 24 * 60;
    return Math.round((mins / 60) * 100) / 100;
  }

  function fmt(n, digits) {
    const v = Number(n);
    if (n === null || n === undefined || n === "" || isNaN(v)) return "—";
    digits = (digits === undefined || digits === null) ? 0 : digits;
    return v.toLocaleString("pt-BR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function fmtDate(d) {
    if (!d) return "—";
    const parts = String(d).split("-");
    if (parts.length !== 3) return d;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function esc(s) {
    return String(s === undefined || s === null ? "" : s).replace(
      /[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  }

  function icon(name, cls) {
    return '<svg class="i ' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      (ICONS[name] || ICONS.info) + "</svg>";
  }

  /* Hash de PIN. Usa SHA-256 quando disponível (HTTPS/localhost),
     com fallback simples para o caso de abrir por arquivo local. */
  async function hashPin(pin) {
    const str = "cp::" + String(pin) + "::furcao";
    if (window.crypto && window.crypto.subtle) {
      try {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
      } catch (e) { /* tenta fallback abaixo */ }
    }
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return "fnv:" + (h >>> 0).toString(16);
  }

  window.U = {
    todayStr: todayStr,
    timeDiffHours: timeDiffHours,
    fmt: fmt,
    fmtDate: fmtDate,
    uid: uid,
    esc: esc,
    icon: icon,
    hashPin: hashPin,
    ICONS: ICONS
  };
})();