(() => {
  const SUPABASE_URL = "https://yvnymvyfzpxjxiuadmat.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Ut9Brq0lHzA_bqtiqTCvYw_mncnnuFT";

  const signInBtn = document.getElementById("authSignIn");
  const signOutBtn = document.getElementById("authSignOut");
  const profileEl = document.getElementById("authProfile");

  if (!signInBtn || !signOutBtn || !profileEl || !window.supabase) {
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  const modal = document.createElement("div");
  modal.className = "auth-modal";
  modal.id = "authModal";
  modal.innerHTML = `
    <div class="auth-dialog">
      <h3>Membership</h3>
      <p>Create an account or sign in to your membership.</p>
      <div class="auth-field">
        <label for="authEmail">Email</label>
        <input id="authEmail" type="email" autocomplete="email" />
      </div>
      <div class="auth-field">
        <label for="authPassword">Password</label>
        <input id="authPassword" type="password" autocomplete="current-password" />
      </div>
      <div class="auth-actions">
        <button id="authSubmitSignIn" class="auth-btn" type="button">Sign In</button>
        <button id="authSubmitSignUp" class="auth-btn" type="button">Sign Up</button>
        <button id="authClose" class="auth-btn" type="button">Close</button>
      </div>
      <div id="authMessage" class="auth-message"></div>
    </div>
  `;
  document.body.appendChild(modal);

  const emailInput = document.getElementById("authEmail");
  const passwordInput = document.getElementById("authPassword");
  const msg = document.getElementById("authMessage");
  const closeBtn = document.getElementById("authClose");
  const submitSignInBtn = document.getElementById("authSubmitSignIn");
  const submitSignUpBtn = document.getElementById("authSubmitSignUp");

  const setMsg = (text, isError = false) => {
    msg.textContent = text;
    msg.style.color = isError ? "#fca5a5" : "#f2cc6c";
  };

  const setAuthUI = (session) => {
    const userEmail = session?.user?.email || "";
    const initial = userEmail ? userEmail[0].toUpperCase() : "?";
    profileEl.textContent = initial;
    profileEl.title = userEmail || "Guest";
    signInBtn.style.display = session ? "none" : "inline-flex";
    signOutBtn.style.display = session ? "inline-flex" : "none";
    profileEl.style.display = session ? "inline-flex" : "none";
  };

  const handleSignIn = async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      setMsg("Email ve şifre gerekli.", true);
      return;
    }
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setMsg(error.message, true);
      return;
    }
    setMsg("Giriş başarılı.");
    modal.classList.remove("open");
  };

  const handleSignUp = async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      setMsg("Email ve şifre gerekli.", true);
      return;
    }
    const { error } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) {
      setMsg(error.message, true);
      return;
    }
    setMsg("Kayıt tamamlandı. E-posta onayı gerekebilir.");
  };

  signInBtn.addEventListener("click", () => {
    setMsg("");
    modal.classList.add("open");
    emailInput.focus();
  });

  signOutBtn.addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) {
      setMsg(error.message, true);
      return;
    }
    setMsg("Çıkış yapıldı.");
  });

  closeBtn.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.classList.remove("open");
    }
  });
  submitSignInBtn.addEventListener("click", handleSignIn);
  submitSignUpBtn.addEventListener("click", handleSignUp);

  client.auth.onAuthStateChange((_event, session) => {
    setAuthUI(session);
  });

  client.auth.getSession().then(({ data }) => {
    setAuthUI(data.session);
  });
})();
