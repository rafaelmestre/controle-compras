// ===== cloud-sync.js =====
// Sincronização opcional com Firebase (Auth + Firestore).
// Se não houver configuração salva, o app continua funcionando 100% local
// (localStorage), exatamente como antes. Nada aqui é obrigatório.

const CC_CONFIG_KEY = "cc_firebase_config";

const CloudSync = (function () {
  let app = null;
  let auth = null;
  let db = null;
  let currentUser = null;
  let unsubPedidos = null;
  let unsubBudget = null;
  let onRemoteChangeCb = null; // chamado quando dados remotos mudam (outro dispositivo)
  let onAuthChangeCb = null;   // chamado quando login/logout acontece

  function getSavedConfig() {
    try {
      return JSON.parse(localStorage.getItem(CC_CONFIG_KEY)) || null;
    } catch (e) {
      return null;
    }
  }

  function saveConfig(configObj) {
    localStorage.setItem(CC_CONFIG_KEY, JSON.stringify(configObj));
  }

  function clearConfig() {
    localStorage.removeItem(CC_CONFIG_KEY);
  }

  function isConfigured() {
    return !!getSavedConfig();
  }

  function init(onAuthChange, onRemoteChange) {
    onAuthChangeCb = onAuthChange;
    onRemoteChangeCb = onRemoteChange;
    const cfg = getSavedConfig();
    if (!cfg) return false;

    try {
      app = firebase.initializeApp(cfg);
      auth = firebase.auth();
      db = firebase.firestore();
    } catch (e) {
      console.error("Erro ao iniciar Firebase:", e);
      return false;
    }

    auth.onAuthStateChanged((user) => {
      currentUser = user;
      if (user) {
        attachListeners(user.uid);
      } else {
        detachListeners();
      }
      if (onAuthChangeCb) onAuthChangeCb(user);
    });

    return true;
  }

  function signup(email, password) {
    if (!auth) return Promise.reject(new Error("Firebase não configurado."));
    return auth.createUserWithEmailAndPassword(email, password);
  }

  function login(email, password) {
    if (!auth) return Promise.reject(new Error("Firebase não configurado."));
    return auth.signInWithEmailAndPassword(email, password);
  }

  function logout() {
    if (!auth) return Promise.resolve();
    return auth.signOut();
  }

  function getCurrentUser() {
    return currentUser;
  }

  // ---------- Listeners em tempo real (cross-device) ----------
  function attachListeners(uid) {
    detachListeners();
    unsubPedidos = db.collection("users").doc(uid).collection("pedidos")
      .onSnapshot((snap) => {
        if (snap.metadata.hasPendingWrites) return; // ignora eco da própria escrita
        if (onRemoteChangeCb) onRemoteChangeCb("pedidos");
      });
    unsubBudget = db.collection("users").doc(uid).collection("budget")
      .onSnapshot((snap) => {
        if (snap.metadata.hasPendingWrites) return;
        if (onRemoteChangeCb) onRemoteChangeCb("budget");
      });
  }

  function detachListeners() {
    if (unsubPedidos) unsubPedidos();
    if (unsubBudget) unsubBudget();
    unsubPedidos = null;
    unsubBudget = null;
  }

  // ---------- Leitura completa da nuvem ----------
  async function fetchAllPedidos() {
    if (!currentUser) return [];
    const snap = await db.collection("users").doc(currentUser.uid).collection("pedidos").get();
    return snap.docs.map(d => d.data());
  }

  async function fetchAllBudget() {
    if (!currentUser) return {};
    const snap = await db.collection("users").doc(currentUser.uid).collection("budget").get();
    const out = {};
    snap.docs.forEach(d => { out[d.id] = d.data(); });
    return out;
  }

  // ---------- Escrita (fire-and-forget, não trava a UI) ----------
  function pushPedido(pedido) {
    if (!currentUser) return;
    db.collection("users").doc(currentUser.uid).collection("pedidos").doc(pedido.id)
      .set(pedido).catch(e => console.warn("Falha ao sincronizar pedido:", e));
  }

  function deletePedidoRemote(id) {
    if (!currentUser) return;
    db.collection("users").doc(currentUser.uid).collection("pedidos").doc(id)
      .delete().catch(e => console.warn("Falha ao remover pedido na nuvem:", e));
  }

  function pushBudgetYear(year, dataObj) {
    if (!currentUser) return;
    db.collection("users").doc(currentUser.uid).collection("budget").doc(String(year))
      .set(dataObj).catch(e => console.warn("Falha ao sincronizar budget:", e));
  }

  return {
    getSavedConfig, saveConfig, clearConfig, isConfigured,
    init, signup, login, logout, getCurrentUser,
    fetchAllPedidos, fetchAllBudget,
    pushPedido, deletePedidoRemote, pushBudgetYear
  };
})();
