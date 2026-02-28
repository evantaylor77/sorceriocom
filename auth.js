(() => {
  const SUPABASE_URL = "https://yvnymvyfzpxjxiuadmat.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Ut9Brq0lHzA_bqtiqTCvYw_mncnnuFT";

  if (!window.supabase) return;

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  const signInEl = document.getElementById("authSignIn");
  const signOutEl = document.getElementById("authSignOut");
  const profileEl = document.getElementById("authProfile");
  const authMessageEl = document.getElementById("authMessage");

  const setMessage = (message, isError = false) => {
    if (!authMessageEl) return;
    authMessageEl.textContent = message || "";
    authMessageEl.style.color = isError ? "#fca5a5" : "#f2cc6c";
  };

  const setNavAuthUI = (session) => {
    if (!signInEl || !signOutEl || !profileEl) return;

    const userEmail = session?.user?.email || "";
    const initial = userEmail ? userEmail[0].toUpperCase() : "?";
    profileEl.textContent = initial;
    profileEl.title = userEmail || "Guest";
    profileEl.style.display = session ? "inline-flex" : "none";
    signInEl.style.display = session ? "none" : "inline-flex";
    signOutEl.style.display = session ? "inline-flex" : "none";
  };

  if (signOutEl) {
    signOutEl.addEventListener("click", async () => {
      const { error } = await client.auth.signOut();
      if (error) {
        setMessage(error.message, true);
        return;
      }
      setMessage("Signed out.");
      if (window.location.pathname === "/dashboard" || window.location.pathname.endsWith("/dashboard.html")) {
        window.location.href = "/dashboard";
      }
    });
  }

  const signInForm = document.getElementById("dashboardSignInForm");
  const signUpForm = document.getElementById("dashboardSignUpForm");

  if (signInForm) {
    signInForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.getElementById("dashboardEmail")?.value?.trim() || "";
      const password = document.getElementById("dashboardPassword")?.value || "";
      if (!email || !password) {
        setMessage("Email and password are required.", true);
        return;
      }
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message, true);
        return;
      }
      setMessage("Signed in successfully.");
    });
  }

  if (signUpForm) {
    signUpForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.getElementById("dashboardEmail")?.value?.trim() || "";
      const password = document.getElementById("dashboardPassword")?.value || "";
      if (!email || !password) {
        setMessage("Email and password are required.", true);
        return;
      }
      const { error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/dashboard" }
      });
      if (error) {
        setMessage(error.message, true);
        return;
      }
      setMessage("Account created. Please verify your email if required.");
    });
  }

  const dashboardGuestView = document.getElementById("dashboardGuestView");
  const dashboardUserView = document.getElementById("dashboardUserView");
  const dashboardUserEmail = document.getElementById("dashboardUserEmail");

  const setDashboardUI = (session) => {
    if (!dashboardGuestView || !dashboardUserView) return;
    const isSignedIn = Boolean(session);
    dashboardGuestView.style.display = isSignedIn ? "none" : "block";
    dashboardUserView.style.display = isSignedIn ? "block" : "none";
    if (dashboardUserEmail) {
      dashboardUserEmail.textContent = session?.user?.email || "";
    }
  };

  client.auth.onAuthStateChange((_event, session) => {
    setNavAuthUI(session);
    setDashboardUI(session);
  });

  client.auth.getSession().then(({ data }) => {
    setNavAuthUI(data.session);
    setDashboardUI(data.session);
  });
})();
