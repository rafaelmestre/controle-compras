// ===== Controle de Compras — app.js =====

const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const STORAGE_KEY_PEDIDOS = "cc_pedidos";
const STORAGE_KEY_BUDGET = "cc_budget"; // { "2026": { "jan": 25325, ... }, ... }

let state = {
  pedidos: [],
  budget: {},
  editingId: null
};

// ---------- Persistência ----------
function loadState() {
  try {
    state.pedidos = JSON.parse(localStorage.getItem(STORAGE_KEY_PEDIDOS)) || [];
  } catch (e) { state.pedidos = []; }
  try {
    state.budget = JSON.parse(localStorage.getItem(STORAGE_KEY_BUDGET)) || {};
  } catch (e) { state.budget = {}; }
}

function savePedidos() {
  localStorage.setItem(STORAGE_KEY_PEDIDOS, JSON.stringify(state.pedidos));
}

function saveBudgetState() {
  localStorage.setItem(STORAGE_KEY_BUDGET, JSON.stringify(state.budget));
}

// ---------- Utils ----------
function uid() {
  return "p_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
}

function brl(v) {
  v = Number(v) || 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseDate(str) {
  // input type=date gives "YYYY-MM-DD"
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtDateBR(str) {
  if (!str) return "—";
  const d = parseDate(str);
  return d.toLocaleDateString("pt-BR");
}

function yearOf(dateStr) {
  return dateStr ? dateStr.split("-")[0] : null;
}

function monthKeyOf(dateStr) {
  // returns "jan", "fev", ... based on month index
  if (!dateStr) return null;
  const m = Number(dateStr.split("-")[1]) - 1;
  return MESES[m];
}

function weekOfMonth(dateStr) {
  const d = parseDate(dateStr);
  const day = d.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

function slug(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
}

function availableYears() {
  const set = new Set();
  const now = new Date().getFullYear();
  set.add(String(now));
  set.add(String(now + 1));
  state.pedidos.forEach(p => {
    p.parcelas.forEach(pc => { if (pc.vencimento) set.add(yearOf(pc.vencimento)); });
    if (p.faturamento) set.add(yearOf(p.faturamento));
    if (p.aprovacao) set.add(yearOf(p.aprovacao));
  });
  Object.keys(state.budget).forEach(y => set.add(y));
  return Array.from(set).sort();
}

// ---------- Cálculos derivados ----------
function spentByYear(year) {
  // { mesKey: { total, w1, w2, w3, w4 } }
  const result = {};
  MESES.forEach(m => result[m] = { total: 0, w1: 0, w2: 0, w3: 0, w4: 0 });
  state.pedidos.forEach(p => {
    (p.parcelas || []).forEach(pc => {
      if (!pc.vencimento || !pc.valor) return;
      if (yearOf(pc.vencimento) !== String(year)) return;
      const mk = monthKeyOf(pc.vencimento);
      const wk = weekOfMonth(pc.vencimento);
      result[mk].total += Number(pc.valor);
      result[mk]["w" + wk] += Number(pc.valor);
    });
  });
  return result;
}

function budgetForYear(year) {
  return state.budget[year] || {};
}

// ---------- Render: Dashboard ----------
function renderYearSelectors() {
  const years = availableYears();
  ["dashYear", "budgetYear", "exportYear"].forEach(id => {
    const sel = document.getElementById(id);
    const current = sel.value;
    sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
    if (years.includes(current)) sel.value = current;
    else sel.value = String(new Date().getFullYear());
  });
}

function renderDashboard() {
  const year = document.getElementById("dashYear").value;
  const spent = spentByYear(year);
  const budget = budgetForYear(year);

  let totalBudget = 0, totalSpent = 0;
  MESES.forEach(m => {
    totalBudget += Number(budget[m]) || 0;
    totalSpent += spent[m].total;
  });

  const cards = [
    { label: "Budget Anual", value: brl(totalBudget) },
    { label: "Gasto Anual", value: brl(totalSpent) },
    { label: "Saldo Anual", value: brl(totalBudget - totalSpent) },
    { label: "% Utilizado", value: totalBudget ? ((totalSpent / totalBudget) * 100).toFixed(0) + "%" : "—" },
  ];
  document.getElementById("summaryCards").innerHTML = cards.map(c =>
    `<div class="card"><div class="label">${c.label}</div><div class="value">${c.value}</div></div>`
  ).join("");

  const tbody = document.querySelector("#monthlyTable tbody");
  tbody.innerHTML = MESES.map(m => {
    const b = Number(budget[m]) || 0;
    const s = spent[m].total;
    const saldo = b - s;
    const util = b ? ((s / b) * 100) : 0;
    const restante = b ? (100 - util) : 0;
    return `<tr>
      <td>${m}/${String(year).slice(2)}</td>
      <td>${brl(b)}</td>
      <td>${brl(s)}</td>
      <td>${brl(saldo)}</td>
      <td>${b ? util.toFixed(0) + "%" : "—"}</td>
      <td>${b ? restante.toFixed(0) + "%" : "—"}</td>
    </tr>`;
  }).join("");

  renderWeeklySelector(year);
}

function renderWeeklySelector(year) {
  const sel = document.getElementById("weeklyMonthSelect");
  const current = sel.value;
  sel.innerHTML = MESES.map(m => `<option value="${m}">${m}/${String(year).slice(2)}</option>`).join("");
  sel.value = MESES.includes(current) ? current : MESES[new Date().getMonth()];
  renderWeeklyTable();
}

function renderWeeklyTable() {
  const year = document.getElementById("dashYear").value;
  const mk = document.getElementById("weeklyMonthSelect").value;
  document.getElementById("weeklyMonthLabel").textContent = `${mk}/${String(year).slice(2)}`;
  const spent = spentByYear(year)[mk];
  const budget = Number(budgetForYear(year)[mk]) || 0;
  const weekBudget = budget / 4;
  const periods = ["dia 01–07", "dia 08–14", "dia 15–21", "dia 22–fim"];

  const tbody = document.querySelector("#weeklyTable tbody");
  tbody.innerHTML = [1, 2, 3, 4].map(w => {
    const val = spent["w" + w];
    const pct = weekBudget ? Math.min(100, (val / weekBudget) * 100) : 0;
    return `<tr>
      <td>Semana ${w}</td>
      <td>${periods[w - 1]}</td>
      <td>${brl(val)}</td>
      <td><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div></td>
    </tr>`;
  }).join("");
}

// ---------- Render: Pedidos ----------
function statusClass(status) {
  return "status-" + slug(status);
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Calcula o prazo de entrega/pagamento automaticamente a partir dos vencimentos,
// eliminando o preenchimento manual que existia na planilha original.
function computeEntrega(p) {
  if (p.status === "PAGO" || p.status === "CANCELADO") return { label: p.status === "PAGO" ? "PAGO" : "—", cls: p.status === "PAGO" ? "entrega-dentro" : "" };
  const hoje = todayStr();
  const pendentes = (p.parcelas || []).filter(pc => pc.vencimento);
  if (!pendentes.length) return { label: "SEM VENCIMENTO", cls: "" };
  const vencidos = pendentes.filter(pc => pc.vencimento < hoje);
  if (vencidos.length) return { label: "ATRASADO", cls: "entrega-atrasada" };
  const proximo = pendentes.slice().sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
  const diasRestantes = (parseDate(proximo.vencimento) - parseDate(hoje)) / 86400000;
  if (diasRestantes <= 7) return { label: "VENCE EM " + Math.ceil(diasRestantes) + " DIA(S)", cls: "entrega-atencao" };
  return { label: "DENTRO DO PRAZO", cls: "entrega-dentro" };
}

function renderAlerts() {
  const hoje = todayStr();
  const atrasados = [];
  const proximos = [];
  state.pedidos.forEach(p => {
    if (p.status === "PAGO" || p.status === "CANCELADO") return;
    (p.parcelas || []).forEach(pc => {
      if (!pc.vencimento) return;
      const dias = (parseDate(pc.vencimento) - parseDate(hoje)) / 86400000;
      if (dias < 0) atrasados.push({ p, pc, dias });
      else if (dias <= 7) proximos.push({ p, pc, dias });
    });
  });

  const panel = document.getElementById("alertsPanel");
  if (!atrasados.length && !proximos.length) {
    panel.innerHTML = `<div class="alert-box alert-ok">✓ Nenhum pedido atrasado ou vencendo nos próximos 7 dias.</div>`;
    return;
  }
  let html = "";
  if (atrasados.length) {
    html += `<div class="alert-box alert-danger"><strong>⚠ ${atrasados.length} vencimento(s) atrasado(s)</strong><ul>` +
      atrasados.sort((a, b) => a.dias - b.dias).map(a =>
        `<li>${a.p.fornecedor || "(sem fornecedor)"} — ${a.p.numero || ""} — venceu em ${fmtDateBR(a.pc.vencimento)} — ${brl(a.pc.valor)}</li>`
      ).join("") + `</ul></div>`;
  }
  if (proximos.length) {
    html += `<div class="alert-box alert-warning"><strong>🔔 ${proximos.length} vencimento(s) nos próximos 7 dias</strong><ul>` +
      proximos.sort((a, b) => a.dias - b.dias).map(a =>
        `<li>${a.p.fornecedor || "(sem fornecedor)"} — ${a.p.numero || ""} — vence em ${fmtDateBR(a.pc.vencimento)} — ${brl(a.pc.valor)}</li>`
      ).join("") + `</ul></div>`;
  }
  panel.innerHTML = html;
}

function renderPedidosTable() {
  const search = document.getElementById("searchBox").value.toLowerCase();
  const filterStatus = document.getElementById("filterStatus").value;

  let list = state.pedidos.filter(p => {
    const matchesSearch = !search || [p.numero, p.os, p.fornecedor, p.cotacao].join(" ").toLowerCase().includes(search);
    const matchesStatus = !filterStatus || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  list = list.slice().sort((a, b) => (b.aprovacao || "").localeCompare(a.aprovacao || ""));

  const tbody = document.querySelector("#pedidosTable tbody");
  tbody.innerHTML = list.map(p => {
    const venc = (p.parcelas || []).map(pc => pc.vencimento ? `${fmtDateBR(pc.vencimento)} (${brl(pc.valor)})` : "").filter(Boolean).join("<br>");
    const entrega = computeEntrega(p);
    return `<tr>
      <td>${p.numero || ""}</td>
      <td>${p.os || ""}</td>
      <td>${p.fornecedor || ""}</td>
      <td>${brl(p.valor)}</td>
      <td>${fmtDateBR(p.aprovacao)}</td>
      <td>${fmtDateBR(p.faturamento)}</td>
      <td>${venc || "—"}</td>
      <td><span class="status-badge ${statusClass(p.status)}">${p.status || ""}</span></td>
      <td class="${entrega.cls}">${entrega.label}</td>
      <td>
        <button class="btn-secondary btn-small" onclick="editPedido('${p.id}')">Editar</button>
        <button class="btn-danger btn-small" onclick="deletePedido('${p.id}')">Excluir</button>
      </td>
    </tr>`;
  }).join("");
}

function addParcelaRow(venc = "", valor = "") {
  const wrap = document.getElementById("parcelasWrap");
  const row = document.createElement("div");
  row.className = "parcela-row";
  row.innerHTML = `
    <label>Vencimento <input type="date" class="parcVenc" value="${venc}"></label>
    <label>Valor R$ <input type="number" step="0.01" class="parcValor" value="${valor}"></label>
    <button type="button" class="btn-danger btn-small" onclick="this.parentElement.remove()">×</button>
  `;
  wrap.appendChild(row);
}

function clearForm() {
  document.getElementById("pedidoId").value = "";
  document.getElementById("fNumero").value = "";
  document.getElementById("fOS").value = "";
  document.getElementById("fCotacao").value = "";
  document.getElementById("fFornecedor").value = "";
  document.getElementById("fValor").value = "";
  document.getElementById("fAprovacao").value = "";
  document.getElementById("fFaturamento").value = "";
  document.getElementById("fStatus").value = "AG. APROVAÇÃO";
  document.getElementById("parcelasWrap").innerHTML = "";
  addParcelaRow();
  document.getElementById("formTitle").textContent = "Novo Pedido";
  document.getElementById("cancelEdit").style.display = "none";
  state.editingId = null;
}

function collectFormData() {
  const parcelas = Array.from(document.querySelectorAll(".parcela-row")).map(row => ({
    vencimento: row.querySelector(".parcVenc").value,
    valor: parseFloat(row.querySelector(".parcValor").value) || 0
  })).filter(pc => pc.vencimento || pc.valor);

  return {
    numero: document.getElementById("fNumero").value.trim(),
    os: document.getElementById("fOS").value.trim(),
    cotacao: document.getElementById("fCotacao").value.trim(),
    fornecedor: document.getElementById("fFornecedor").value.trim(),
    valor: parseFloat(document.getElementById("fValor").value) || 0,
    aprovacao: document.getElementById("fAprovacao").value,
    faturamento: document.getElementById("fFaturamento").value,
    status: document.getElementById("fStatus").value,
    parcelas
  };
}

function savePedidoHandler() {
  const data = collectFormData();
  if (!data.fornecedor) {
    alert("Informe ao menos o fornecedor.");
    return;
  }
  data.updatedAt = Date.now();
  let saved;
  if (state.editingId) {
    const idx = state.pedidos.findIndex(p => p.id === state.editingId);
    if (idx > -1) {
      state.pedidos[idx] = { ...state.pedidos[idx], ...data };
      saved = state.pedidos[idx];
    }
  } else {
    saved = { id: uid(), ...data };
    state.pedidos.push(saved);
  }
  savePedidos();
  if (saved) CloudSync.pushPedido(saved);
  clearForm();
  renderAll();
}

window.editPedido = function (id) {
  const p = state.pedidos.find(p => p.id === id);
  if (!p) return;
  state.editingId = id;
  document.getElementById("pedidoId").value = p.id;
  document.getElementById("fNumero").value = p.numero || "";
  document.getElementById("fOS").value = p.os || "";
  document.getElementById("fCotacao").value = p.cotacao || "";
  document.getElementById("fFornecedor").value = p.fornecedor || "";
  document.getElementById("fValor").value = p.valor || "";
  document.getElementById("fAprovacao").value = p.aprovacao || "";
  document.getElementById("fFaturamento").value = p.faturamento || "";
  document.getElementById("fStatus").value = p.status || "AG. APROVAÇÃO";
  document.getElementById("parcelasWrap").innerHTML = "";
  (p.parcelas && p.parcelas.length ? p.parcelas : [{ vencimento: "", valor: "" }]).forEach(pc => addParcelaRow(pc.vencimento, pc.valor));
  document.getElementById("formTitle").textContent = "Editar Pedido";
  document.getElementById("cancelEdit").style.display = "inline-block";
  document.querySelector('[data-tab="pedidos"]').click();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.deletePedido = function (id) {
  if (!confirm("Excluir este pedido? Essa ação não pode ser desfeita.")) return;
  state.pedidos = state.pedidos.filter(p => p.id !== id);
  savePedidos();
  CloudSync.deletePedidoRemote(id);
  renderAll();
};

// ---------- Render: Budget ----------
function renderBudgetTable() {
  const year = document.getElementById("budgetYear").value;
  const budget = budgetForYear(year);
  const tbody = document.querySelector("#budgetTable tbody");
  tbody.innerHTML = MESES.map(m => `
    <tr>
      <td>${m}/${String(year).slice(2)}</td>
      <td><input type="number" step="0.01" class="budgetInput" data-mes="${m}" value="${budget[m] || ""}"></td>
    </tr>
  `).join("");
}

function saveBudgetHandler() {
  const year = document.getElementById("budgetYear").value;
  if (!state.budget[year]) state.budget[year] = {};
  document.querySelectorAll(".budgetInput").forEach(inp => {
    state.budget[year][inp.dataset.mes] = parseFloat(inp.value) || 0;
  });
  state.budget[year].updatedAt = Date.now();
  saveBudgetState();
  CloudSync.pushBudgetYear(year, state.budget[year]);
  renderAll();
  alert("Budget salvo.");
}

// ---------- Exportar Excel ----------
function exportExcel() {
  const year = document.getElementById("exportYear").value;
  const spent = spentByYear(year);
  const budget = budgetForYear(year);

  // Aba Resumo
  const resumoRows = [["Mês", "Budget", "Gasto", "Saldo", "% Utilizado", "% Saldo"]];
  let totB = 0, totS = 0;
  MESES.forEach(m => {
    const b = Number(budget[m]) || 0;
    const s = spent[m].total;
    totB += b; totS += s;
    const util = b ? (s / b) * 100 : 0;
    resumoRows.push([`${m}/${year}`, b, s, b - s, b ? Math.round(util) + "%" : "—", b ? Math.round(100 - util) + "%" : "—"]);
  });
  resumoRows.push(["TOTAL ANUAL", totB, totS, totB - totS, totB ? Math.round((totS / totB) * 100) + "%" : "—", totB ? Math.round(100 - (totS / totB) * 100) + "%" : "—"]);

  // Aba Semanal
  const semanalRows = [["Mês", "Semana", "Período", "Gasto"]];
  const periods = ["dia 01–07", "dia 08–14", "dia 15–21", "dia 22–fim"];
  MESES.forEach(m => {
    [1, 2, 3, 4].forEach(w => {
      semanalRows.push([`${m}/${year}`, "Semana " + w, periods[w - 1], spent[m]["w" + w]]);
    });
  });

  // Aba Pedidos
  const pedidosRows = [["N° Pedido", "OS/Pedido Compra", "Cotação", "Fornecedor", "Valor Total", "Aprovação", "Faturamento", "Vencimentos", "Status", "Entrega"]];
  state.pedidos
    .filter(p => {
      const anyYearMatch = (p.parcelas || []).some(pc => yearOf(pc.vencimento) === String(year))
        || yearOf(p.aprovacao) === String(year) || yearOf(p.faturamento) === String(year);
      return anyYearMatch;
    })
    .forEach(p => {
      const venc = (p.parcelas || []).map(pc => pc.vencimento ? `${fmtDateBR(pc.vencimento)}: ${brl(pc.valor)}` : "").filter(Boolean).join(" | ");
      pedidosRows.push([p.numero, p.os, p.cotacao, p.fornecedor, p.valor, fmtDateBR(p.aprovacao), fmtDateBR(p.faturamento), venc, p.status, computeEntrega(p).label]);
    });

  const wb = XLSX.utils.book_new();
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
  const wsSemanal = XLSX.utils.aoa_to_sheet(semanalRows);
  const wsPedidos = XLSX.utils.aoa_to_sheet(pedidosRows);

  wsResumo["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
  wsSemanal["!cols"] = [{ wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
  wsPedidos["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 18 }, { wch: 22 }];

  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");
  XLSX.utils.book_append_sheet(wb, wsSemanal, "Semanal");
  XLSX.utils.book_append_sheet(wb, wsPedidos, "Pedidos");

  XLSX.writeFile(wb, `controle-compras-${year}.xlsx`);
}

// ---------- Render geral ----------
function renderAll() {
  renderYearSelectors();
  renderDashboard();
  renderAlerts();
  renderPedidosTable();
  renderBudgetTable();
}

// ---------- Tabs ----------
function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}

// ---------- Nuvem (Firebase) ----------
function mergeById(localList, remoteList) {
  const map = {};
  localList.forEach(p => { map[p.id] = p; });
  remoteList.forEach(rp => {
    const lp = map[rp.id];
    if (!lp || (rp.updatedAt || 0) > (lp.updatedAt || 0)) {
      map[rp.id] = rp;
    }
  });
  return Object.values(map);
}

function setSyncDot(cls, title) {
  const dot = document.getElementById("syncDot");
  dot.className = "sync-dot " + cls;
  dot.title = title;
}

async function syncFromCloud() {
  const user = CloudSync.getCurrentUser();
  if (!user) return;
  setSyncDot("sync-syncing", "Sincronizando...");
  document.getElementById("syncStatusText").textContent = "sincronizando...";
  try {
    const [remotePedidos, remoteBudget] = await Promise.all([
      CloudSync.fetchAllPedidos(),
      CloudSync.fetchAllBudget()
    ]);

    state.pedidos = mergeById(state.pedidos, remotePedidos);
    savePedidos();
    state.pedidos.forEach(p => CloudSync.pushPedido(p));

    Object.keys(remoteBudget).forEach(year => {
      const remoteYearObj = remoteBudget[year] || {};
      const localYearObj = state.budget[year];
      if (!localYearObj || (remoteYearObj.updatedAt || 0) > (localYearObj.updatedAt || 0)) {
        state.budget[year] = remoteYearObj;
      }
    });
    saveBudgetState();
    Object.keys(state.budget).forEach(year => CloudSync.pushBudgetYear(year, state.budget[year]));

    renderAll();
    setSyncDot("sync-on", "Sincronizado");
    document.getElementById("syncStatusText").textContent = "sincronizado";
  } catch (e) {
    console.error("Erro ao sincronizar:", e);
    setSyncDot("sync-error", "Erro ao sincronizar — verifique sua conexão");
    document.getElementById("syncStatusText").textContent = "erro ao sincronizar";
  }
}

function updateAuthUI(user) {
  const configBox = document.getElementById("cloudConfigBox");
  const authBox = document.getElementById("cloudAuthBox");
  const loggedOut = document.getElementById("loggedOutBox");
  const loggedIn = document.getElementById("loggedInBox");
  const clearBtn = document.getElementById("clearFirebaseConfig");

  if (CloudSync.isConfigured()) {
    authBox.style.display = "block";
    clearBtn.style.display = "inline-block";
  } else {
    authBox.style.display = "none";
    clearBtn.style.display = "none";
    setSyncDot("sync-off", "Sem sincronização");
    return;
  }

  if (user) {
    loggedOut.style.display = "none";
    loggedIn.style.display = "block";
    document.getElementById("authUserEmail").textContent = user.email;
    setSyncDot("sync-on", "Sincronizado");
  } else {
    loggedOut.style.display = "block";
    loggedIn.style.display = "none";
    setSyncDot("sync-off", "Sem sincronização (faça login)");
  }
}

function setupCloudUI() {
  const cfg = CloudSync.getSavedConfig();
  if (cfg) {
    document.getElementById("firebaseConfigInput").value = JSON.stringify(cfg, null, 2);
  }

  const configured = CloudSync.init(
    (user) => { updateAuthUI(user); if (user) syncFromCloud(); },
    () => { syncFromCloud(); }
  );
  updateAuthUI(configured ? CloudSync.getCurrentUser() : null);

  document.getElementById("saveFirebaseConfig").addEventListener("click", () => {
    const raw = document.getElementById("firebaseConfigInput").value.trim();
    const msg = document.getElementById("cloudConfigMsg");
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.apiKey || !parsed.projectId) throw new Error("Config incompleta.");
      CloudSync.saveConfig(parsed);
      msg.textContent = "Configuração salva. Recarregando...";
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      msg.textContent = "JSON inválido. Cole exatamente o objeto firebaseConfig do console do Firebase.";
    }
  });

  document.getElementById("clearFirebaseConfig").addEventListener("click", () => {
    if (!confirm("Remover a configuração de nuvem? A sincronização será desativada neste navegador.")) return;
    CloudSync.clearConfig();
    location.reload();
  });

  document.getElementById("btnLogin").addEventListener("click", () => {
    const email = document.getElementById("authEmail").value.trim();
    const pass = document.getElementById("authPassword").value;
    const msg = document.getElementById("cloudAuthMsg");
    CloudSync.login(email, pass)
      .then(() => { msg.textContent = ""; })
      .catch(e => { msg.textContent = "Erro ao entrar: " + e.message; });
  });

  document.getElementById("btnSignup").addEventListener("click", () => {
    const email = document.getElementById("authEmail").value.trim();
    const pass = document.getElementById("authPassword").value;
    const msg = document.getElementById("cloudAuthMsg");
    CloudSync.signup(email, pass)
      .then(() => { msg.textContent = ""; })
      .catch(e => { msg.textContent = "Erro ao criar conta: " + e.message; });
  });

  document.getElementById("btnLogout").addEventListener("click", () => {
    CloudSync.logout();
  });

  document.getElementById("btnSyncNow").addEventListener("click", syncFromCloud);
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  setupTabs();
  renderAll();
  addParcelaRow();

  document.getElementById("addParcela").addEventListener("click", () => addParcelaRow());
  document.getElementById("savePedido").addEventListener("click", savePedidoHandler);
  document.getElementById("cancelEdit").addEventListener("click", clearForm);
  document.getElementById("searchBox").addEventListener("input", renderPedidosTable);
  document.getElementById("filterStatus").addEventListener("change", renderPedidosTable);
  document.getElementById("dashYear").addEventListener("change", renderDashboard);
  document.getElementById("weeklyMonthSelect").addEventListener("change", renderWeeklyTable);
  document.getElementById("budgetYear").addEventListener("change", renderBudgetTable);
  document.getElementById("saveBudget").addEventListener("click", saveBudgetHandler);
  document.getElementById("exportBtn").addEventListener("click", exportExcel);
  setupCloudUI();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});