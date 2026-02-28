(() => {
  const SUPABASE_URL = "https://yvnymvyfzpxjxiuadmat.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Ut9Brq0lHzA_bqtiqTCvYw_mncnnuFT";

  if (!window.supabase) return;

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  const signInEl = document.getElementById("authSignIn");
  const signOutEl = document.getElementById("authSignOut");
  const profileEl = document.getElementById("authProfile");

  const isDashboard = window.location.pathname === "/dashboard" || window.location.pathname.endsWith("/dashboard.html");

  const authStepEmail = document.getElementById("authStepEmail");
  const authStepPassword = document.getElementById("authStepPassword");
  const dashboardUserView = document.getElementById("dashboardUserView");
  const dashboardUserEmail = document.getElementById("dashboardUserEmail");

  const authMessageEl = document.getElementById("authMessage");
  const authMessageStep2El = document.getElementById("authMessageStep2");

  const dashboardEmailEl = document.getElementById("dashboardEmail");
  const dashboardEmailConfirmEl = document.getElementById("dashboardEmailConfirm");
  const dashboardPasswordEl = document.getElementById("dashboardPassword");

  const continueToPasswordBtn = document.getElementById("continueToPassword");
  const passwordSubmitBtn = document.getElementById("passwordSubmit");
  const backToEmailBtn = document.getElementById("backToEmail");
  const forgotPasswordLink = document.getElementById("forgotPasswordLink");
  const emailCodeSignInBtn = document.getElementById("emailCodeSignIn");
  const toggleSignMode = document.getElementById("toggleSignMode");

  const oauthGoogleBtn = document.getElementById("oauthGoogle");
  const oauthGithubBtn = document.getElementById("oauthGithub");
  const oauthAppleBtn = document.getElementById("oauthApple");

  let isSignUpMode = false;
  let checkedEmailExists = null;

  const setMessage = (message, isError = false, step = 1) => {
    const target = step === 2 ? authMessageStep2El : authMessageEl;
    if (!target) return;
    target.textContent = message || "";
    target.style.color = isError ? "#fca5a5" : "#f2cc6c";
  };

  const clearMessages = () => {
    setMessage("");
    setMessage("", false, 2);
  };

  const showStep = (stepNumber) => {
    if (!authStepEmail || !authStepPassword) return;
    authStepEmail.classList.toggle("active", stepNumber === 1);
    authStepPassword.classList.toggle("active", stepNumber === 2);
    clearMessages();
  };

  const syncAuthModeText = () => {
    if (toggleSignMode) {
      toggleSignMode.textContent = isSignUpMode ? "Zaten hesabınız var mı? Giriş yap" : "Hesabınız yok mu? Kaydol";
    }
    if (passwordSubmitBtn) {
      passwordSubmitBtn.textContent = isSignUpMode ? "Kayıt ol" : "Giriş yap";
    }
    if (forgotPasswordLink) forgotPasswordLink.style.display = isSignUpMode ? "none" : "inline";
    if (emailCodeSignInBtn) emailCodeSignInBtn.style.display = isSignUpMode ? "none" : "inline-flex";
  };

  const resolveEmailExists = (rpcData) => {
    if (typeof rpcData === "boolean") return rpcData;
    if (typeof rpcData === "string") return rpcData.toLowerCase() === "true" || rpcData === "t";
    if (rpcData && typeof rpcData === "object") {
      if (typeof rpcData.check_email_exists === "boolean") return rpcData.check_email_exists;
      if (typeof rpcData.exists === "boolean") return rpcData.exists;
    }
    return false;
  };

  const authRedirectTo = window.location.origin + "/dashboard";

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

  const setDashboardUI = (session) => {
    if (!isDashboard || !dashboardUserView) return;

    const signedIn = Boolean(session);
    if (authStepEmail && authStepPassword) {
      authStepEmail.style.display = signedIn ? "none" : "";
      authStepPassword.style.display = signedIn ? "none" : "";
      if (!signedIn) showStep(1);
    }
    dashboardUserView.style.display = signedIn ? "block" : "none";

    if (dashboardUserEmail) {
      dashboardUserEmail.textContent = session?.user?.email || "";
    }
  };

  const signInWithOAuth = async (provider) => {
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authRedirectTo }
    });
    if (error) setMessage(error.message, true);
  };

  if (oauthGoogleBtn) oauthGoogleBtn.addEventListener("click", () => signInWithOAuth("google"));
  if (oauthGithubBtn) oauthGithubBtn.addEventListener("click", () => signInWithOAuth("github"));
  if (oauthAppleBtn) oauthAppleBtn.addEventListener("click", () => signInWithOAuth("apple"));

  if (toggleSignMode) {
    toggleSignMode.addEventListener("click", () => {
      isSignUpMode = !isSignUpMode;
      checkedEmailExists = !isSignUpMode;
      syncAuthModeText();
    });
  }

  if (continueToPasswordBtn) {
    continueToPasswordBtn.addEventListener("click", async () => {
      const email = dashboardEmailEl?.value?.trim() || "";
      if (!email) {
        setMessage("E-posta adresinizi girin.", true);
        return;
      }

      const { data, error: checkError } = await client.rpc("check_email_exists", {
        input_email: email
      });
      if (checkError) {
        setMessage("E-posta kontrolü yapılamadı. Tekrar deneyin.", true);
        return;
      }

      const emailExists = resolveEmailExists(data);
      checkedEmailExists = emailExists;
      isSignUpMode = !emailExists;
      syncAuthModeText();

      if (dashboardEmailConfirmEl) dashboardEmailConfirmEl.value = email;
      showStep(2);
      if (dashboardPasswordEl) {
        dashboardPasswordEl.value = "";
        dashboardPasswordEl.focus();
      }
      if (!emailExists) {
        setMessage("Bu e-posta kayıtlı değil. Kayıt moduna geçildi.", false, 2);
      }
    });
  }

  if (backToEmailBtn) {
    backToEmailBtn.addEventListener("click", () => showStep(1));
  }

  if (emailCodeSignInBtn) {
    emailCodeSignInBtn.addEventListener("click", async () => {
      const email = dashboardEmailConfirmEl?.value?.trim() || dashboardEmailEl?.value?.trim() || "";
      if (!email) {
        setMessage("E-posta adresinizi girin.", true, 2);
        return;
      }
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: authRedirectTo }
      });
      if (error) {
        setMessage(error.message, true, 2);
        return;
      }
      setMessage("Giriş kodu e-postanıza gönderildi.", false, 2);
    });
  }

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", async () => {
      const email = dashboardEmailConfirmEl?.value?.trim() || dashboardEmailEl?.value?.trim() || "";
      if (!email) {
        setMessage("Önce e-posta girin.", true, 2);
        return;
      }
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: authRedirectTo });
      if (error) {
        setMessage(error.message, true, 2);
        return;
      }
      setMessage("Şifre sıfırlama bağlantısı gönderildi.", false, 2);
    });
  }

  if (passwordSubmitBtn) {
    passwordSubmitBtn.addEventListener("click", async () => {
      const email = dashboardEmailConfirmEl?.value?.trim() || dashboardEmailEl?.value?.trim() || "";
      const password = dashboardPasswordEl?.value || "";

      if (!email || !password) {
        setMessage("E-posta ve şifre gerekli.", true, 2);
        return;
      }

      if (checkedEmailExists === false) isSignUpMode = true;
      syncAuthModeText();

      if (isSignUpMode) {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: authRedirectTo }
        });
        if (error) {
          setMessage(error.message, true, 2);
          return;
        }
        if (data?.session) {
          setMessage("Kayıt başarılı. Giriş yapıldı.", false, 2);
          return;
        }
        setMessage("Kayıt başarılı. E-posta doğrulaması sonrası giriş yapabilirsiniz.", false, 2);
        return;
      }

      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message, true, 2);
        return;
      }
      setMessage("Giriş başarılı.", false, 2);
    });
  }

  if (signOutEl) {
    signOutEl.addEventListener("click", async () => {
      const { error } = await client.auth.signOut();
      if (error) {
        setMessage(error.message, true);
        return;
      }
      if (isDashboard) window.location.href = "/dashboard";
    });
  }

  client.auth.onAuthStateChange((_event, session) => {
    setNavAuthUI(session);
    setDashboardUI(session);
  });

  client.auth.getSession().then(({ data }) => {
    setNavAuthUI(data.session);
    setDashboardUI(data.session);
    syncAuthModeText();
    if (!data.session && isDashboard) showStep(1);
  });
})();
