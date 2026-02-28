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
  const authStepVerify = document.getElementById("authStepVerify");
  const dashboardUserView = document.getElementById("dashboardUserView");
  const dashboardUserEmail = document.getElementById("dashboardUserEmail");

  const authMessageEl = document.getElementById("authMessage");
  const authMessageStep2El = document.getElementById("authMessageStep2");
  const authMessageStep3El = document.getElementById("authMessageStep3");

  const dashboardEmailEl = document.getElementById("dashboardEmail");
  const dashboardEmailConfirmEl = document.getElementById("dashboardEmailConfirm");
  const dashboardPasswordEl = document.getElementById("dashboardPassword");
  const verifyEmailEl = document.getElementById("verifyEmail");
  const verifyCodeEl = document.getElementById("verifyCode");
  const verifyMaskedEmailEl = document.getElementById("verifyMaskedEmail");
  const verifyOtpDigitEls = Array.from(document.querySelectorAll(".verify-otp-digit"));

  const continueToPasswordBtn = document.getElementById("continueToPassword");
  const passwordSubmitBtn = document.getElementById("passwordSubmit");
  const backToEmailBtn = document.getElementById("backToEmail");
  const backToPasswordFromVerifyBtn = document.getElementById("backToPasswordFromVerify");
  const forgotPasswordLink = document.getElementById("forgotPasswordLink");
  const emailCodeSignInBtn = document.getElementById("emailCodeSignIn");
  const verifyCodeSubmitBtn = document.getElementById("verifyCodeSubmit");
  const resendVerifyCodeBtn = document.getElementById("resendVerifyCode");
  const toggleSignMode = document.getElementById("toggleSignMode");

  const oauthGoogleBtn = document.getElementById("oauthGoogle");
  const oauthGithubBtn = document.getElementById("oauthGithub");
  const oauthAppleBtn = document.getElementById("oauthApple");

  let isSignUpMode = false;
  let checkedEmailExists = null;
  let pendingVerificationEmail = "";
  let pendingVerificationType = "signup";
  let resendCooldownTimer = null;
  const resendCooldownSeconds = 55;

  const maskEmail = (email) => {
    const normalized = String(email || "").trim().toLowerCase();
    const at = normalized.indexOf("@");
    if (at <= 1) return "*****";
    const local = normalized.slice(0, at);
    const domain = normalized.slice(at);
    const start = local.slice(0, 1);
    const end = local.slice(-2);
    return `${start}${"*".repeat(Math.max(3, local.length - 3))}${end}${domain}`;
  };

  const updateVerifyMaskedEmail = (email) => {
    if (verifyMaskedEmailEl) verifyMaskedEmailEl.textContent = maskEmail(email);
  };

  const syncHiddenVerifyCode = () => {
    if (!verifyCodeEl || verifyOtpDigitEls.length === 0) return;
    verifyCodeEl.value = verifyOtpDigitEls.map((el) => (el.value || "").replace(/\D/g, "")).join("");
  };

  const clearOtpDigits = () => {
    verifyOtpDigitEls.forEach((el) => { el.value = ""; });
    syncHiddenVerifyCode();
  };

  const focusOtpIndex = (index) => {
    const target = verifyOtpDigitEls[index];
    if (!target) return;
    target.focus();
    target.select();
  };

  const setMessage = (message, isError = false, step = 1) => {
    const target = step === 2 ? authMessageStep2El : step === 3 ? authMessageStep3El : authMessageEl;
    if (!target) return;
    target.textContent = message || "";
    target.style.color = isError ? "#fca5a5" : "#f2cc6c";
  };

  const clearMessages = () => {
    setMessage("");
    setMessage("", false, 2);
    setMessage("", false, 3);
  };

  const showStep = (stepNumber) => {
    if (authStepEmail) authStepEmail.classList.toggle("active", stepNumber === 1);
    if (authStepPassword) authStepPassword.classList.toggle("active", stepNumber === 2);
    if (authStepVerify) authStepVerify.classList.toggle("active", stepNumber === 3);
    clearMessages();
  };

  const setButtonLoading = (button, loading, loadingText) => {
    if (!button) return;
    if (loading) {
      button.dataset.originalText = button.textContent || "";
      button.disabled = true;
      if (loadingText) button.textContent = loadingText;
      button.classList.add("is-loading");
      return;
    }
    button.disabled = false;
    if (button.dataset.originalText) button.textContent = button.dataset.originalText;
    button.classList.remove("is-loading");
  };

  const updateResendButtonText = (remaining) => {
    if (!resendVerifyCodeBtn) return;
    if (remaining <= 0) {
      resendVerifyCodeBtn.disabled = false;
      resendVerifyCodeBtn.textContent = "Tekrar gonder";
      return;
    }
    resendVerifyCodeBtn.disabled = true;
    resendVerifyCodeBtn.textContent = `Tekrar gonder (${remaining}s)`;
  };

  const startResendCooldown = () => {
    if (resendCooldownTimer) window.clearInterval(resendCooldownTimer);
    let remaining = resendCooldownSeconds;
    updateResendButtonText(remaining);
    resendCooldownTimer = window.setInterval(() => {
      remaining -= 1;
      updateResendButtonText(remaining);
      if (remaining <= 0) {
        window.clearInterval(resendCooldownTimer);
        resendCooldownTimer = null;
      }
    }, 1000);
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

  const POST_AUTH_INTENT_KEY = "ozmcp_post_auth_intent";
  const authRedirectTo = window.location.origin + "/dashboard?postAuth=1";

  const redirectToHomeAfterAuth = () => {
    try {
      window.sessionStorage.removeItem(POST_AUTH_INTENT_KEY);
    } catch (_) {
      // ignore storage errors
    }
    window.location.href = "/?welcome=1";
  };

  const shouldRedirectToHomeAfterCallback = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("postAuth") === "1") return true;
      return window.sessionStorage.getItem(POST_AUTH_INTENT_KEY) === "1";
    } catch (_) {
      return false;
    }
  };
  const isVerifiedSession = (session) => {
    const confirmedAt = session?.user?.email_confirmed_at || session?.user?.confirmed_at;
    return Boolean(session && confirmedAt);
  };

  const setNavAuthUI = (session) => {
    if (!signInEl || !signOutEl || !profileEl) return;
    const verifiedSession = isVerifiedSession(session) ? session : null;

    const userEmail = verifiedSession?.user?.email || "";
    const initial = userEmail ? userEmail[0].toUpperCase() : "?";

    profileEl.textContent = initial;
    profileEl.title = userEmail || "Guest";
    profileEl.style.display = verifiedSession ? "inline-flex" : "none";
    signInEl.style.display = verifiedSession ? "none" : "inline-flex";
    signOutEl.style.display = verifiedSession ? "inline-flex" : "none";
  };

  const setDashboardUI = (session) => {
    if (!isDashboard || !dashboardUserView) return;

    const signedIn = isVerifiedSession(session);
    if (authStepEmail) authStepEmail.style.display = signedIn ? "none" : "";
    if (authStepPassword) authStepPassword.style.display = signedIn ? "none" : "";
    if (authStepVerify) authStepVerify.style.display = signedIn ? "none" : "";
    if (!signedIn) showStep(1);
    dashboardUserView.style.display = signedIn ? "block" : "none";

    if (dashboardUserEmail) {
      dashboardUserEmail.textContent = session?.user?.email || "";
    }
  };

  const signInWithOAuth = async (provider) => {
    try {
      window.sessionStorage.setItem(POST_AUTH_INTENT_KEY, "1");
    } catch (_) {
      // ignore storage errors
    }
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
      const email = (dashboardEmailEl?.value?.trim() || "").toLowerCase();
      if (!email) {
        setMessage("E-posta adresinizi girin.", true);
        return;
      }
      continueToPasswordBtn.disabled = true;
      continueToPasswordBtn.textContent = "Kontrol ediliyor...";

      const { data, error: checkError } = await client.rpc("check_email_exists", {
        input_email: email
      });
      continueToPasswordBtn.disabled = false;
      continueToPasswordBtn.textContent = "Devam Et";
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
    backToEmailBtn.addEventListener("click", () => {
      pendingVerificationEmail = "";
      showStep(1);
    });
  }

  if (backToPasswordFromVerifyBtn) {
    backToPasswordFromVerifyBtn.addEventListener("click", () => {
      showStep(2);
      if (verifyCodeEl) verifyCodeEl.value = "";
      clearOtpDigits();
    });
  }

  if (verifyOtpDigitEls.length > 0) {
    verifyOtpDigitEls.forEach((digitEl, idx) => {
      digitEl.addEventListener("input", (event) => {
        const raw = String(event.target.value || "");
        const numeric = raw.replace(/\D/g, "");
        event.target.value = numeric ? numeric.slice(-1) : "";
        syncHiddenVerifyCode();
        if (event.target.value && idx < verifyOtpDigitEls.length - 1) focusOtpIndex(idx + 1);
      });

      digitEl.addEventListener("keydown", (event) => {
        if (event.key === "Backspace" && !digitEl.value && idx > 0) {
          focusOtpIndex(idx - 1);
          return;
        }
        if (event.key === "ArrowLeft" && idx > 0) {
          event.preventDefault();
          focusOtpIndex(idx - 1);
          return;
        }
        if (event.key === "ArrowRight" && idx < verifyOtpDigitEls.length - 1) {
          event.preventDefault();
          focusOtpIndex(idx + 1);
        }
      });

      digitEl.addEventListener("paste", (event) => {
        event.preventDefault();
        const pasted = (event.clipboardData?.getData("text") || "").replace(/\D/g, "");
        if (!pasted) return;
        const slice = pasted.slice(0, verifyOtpDigitEls.length).split("");
        verifyOtpDigitEls.forEach((el, i) => { el.value = slice[i] || ""; });
        syncHiddenVerifyCode();
        const focusIndex = Math.min(slice.length, verifyOtpDigitEls.length - 1);
        focusOtpIndex(focusIndex);
      });
    });
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
      pendingVerificationEmail = email.toLowerCase();
      pendingVerificationType = "email";
      if (verifyEmailEl) verifyEmailEl.value = pendingVerificationEmail;
      updateVerifyMaskedEmail(pendingVerificationEmail);
      clearOtpDigits();
      showStep(3);
      focusOtpIndex(0);
      startResendCooldown();
      setMessage("Giriş kodu e-postanıza gönderildi. Kodla devam edin.", false, 3);
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
      const email = (dashboardEmailConfirmEl?.value?.trim() || dashboardEmailEl?.value?.trim() || "").toLowerCase();
      const password = dashboardPasswordEl?.value || "";

      if (!email || !password) {
        setMessage("E-posta ve şifre gerekli.", true, 2);
        return;
      }

      if (checkedEmailExists === false) isSignUpMode = true;
      syncAuthModeText();
      setButtonLoading(passwordSubmitBtn, true, isSignUpMode ? "Kayit olusturuluyor..." : "Giris yapiliyor...");

      if (isSignUpMode) {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: authRedirectTo }
        });
        setButtonLoading(passwordSubmitBtn, false);
        if (error) {
          const lowerMsg = String(error.message || "").toLowerCase();
          if (lowerMsg.includes("rate limit")) {
            pendingVerificationEmail = email;
            pendingVerificationType = "signup";
            if (verifyEmailEl) verifyEmailEl.value = email;
            updateVerifyMaskedEmail(email);
            showStep(3);
            focusOtpIndex(0);
            setMessage("Yeni kod su an gonderilemiyor. Son gelen e-posta kodunu girip devam edin.", true, 3);
            return;
          }
          setMessage(error.message, true, 2);
          return;
        }
        if (data?.session) {
          setMessage("Kayıt başarılı. Giriş yapıldı.", false, 2);
          redirectToHomeAfterAuth();
          return;
        }
        pendingVerificationEmail = email;
        pendingVerificationType = "signup";
        if (verifyEmailEl) verifyEmailEl.value = email;
        updateVerifyMaskedEmail(email);
        if (verifyCodeEl) verifyCodeEl.value = "";
        clearOtpDigits();
        showStep(3);
        focusOtpIndex(0);
        startResendCooldown();
        setMessage("Onay kodu e-postanıza gönderildi. Kodu girip hesabı doğrulayın.", false, 3);
        return;
      }

      const { error } = await client.auth.signInWithPassword({ email, password });
      setButtonLoading(passwordSubmitBtn, false);
      if (error) {
        const lowerMsg = String(error.message || "").toLowerCase();
        if (lowerMsg.includes("email not confirmed")) {
          pendingVerificationEmail = email;
          pendingVerificationType = "signup";
          if (verifyEmailEl) verifyEmailEl.value = email;
          updateVerifyMaskedEmail(email);
          clearOtpDigits();
          showStep(3);
          focusOtpIndex(0);
          setMessage("E-posta dogrulanmadi. E-postadaki kodu girerek devami tamamlayin.", true, 3);
          return;
        }
        if (String(error.message || "").toLowerCase().includes("invalid login credentials")) {
          const { data } = await client.rpc("check_email_exists", { input_email: email });
          const emailExists = resolveEmailExists(data);
          if (!emailExists) {
            checkedEmailExists = false;
            isSignUpMode = true;
            syncAuthModeText();
            setMessage("Bu e-posta kayıtlı değil. Kayıt moduna geçildi, tekrar deneyin.", true, 2);
            return;
          }
        }
        setMessage(error.message, true, 2);
        return;
      }
      const {
        data: { user }
      } = await client.auth.getUser();
      if (!user?.email_confirmed_at) {
        await client.auth.signOut();
        pendingVerificationEmail = email;
        pendingVerificationType = "signup";
        if (verifyEmailEl) verifyEmailEl.value = email;
        updateVerifyMaskedEmail(email);
        clearOtpDigits();
        showStep(3);
        focusOtpIndex(0);
        setMessage("E-posta dogrulama tamamlanmadan giris yapilamaz.", true, 3);
        return;
      }
      setMessage("Giriş başarılı.", false, 2);
      redirectToHomeAfterAuth();
    });
  }

  if (verifyCodeSubmitBtn) {
    verifyCodeSubmitBtn.addEventListener("click", async () => {
      const email = (verifyEmailEl?.value?.trim() || pendingVerificationEmail || "").toLowerCase();
      syncHiddenVerifyCode();
      const token = (verifyCodeEl?.value?.trim() || "").replace(/\D/g, "");
      if (!email || !token) {
        setMessage("E-posta ve onay kodu gerekli.", true, 3);
        return;
      }
      setButtonLoading(verifyCodeSubmitBtn, true, "Kod dogrulaniyor...");
      const preferredType = pendingVerificationType === "email" ? "email" : "signup";
      const fallbackType = preferredType === "signup" ? "email" : "signup";

      let verificationError = null;
      const firstAttempt = await client.auth.verifyOtp({
        email,
        token,
        type: preferredType
      });
      verificationError = firstAttempt.error;

      if (verificationError) {
        const secondAttempt = await client.auth.verifyOtp({
          email,
          token,
          type: fallbackType
        });
        verificationError = secondAttempt.error;
      }

      setButtonLoading(verifyCodeSubmitBtn, false);
      if (verificationError) {
        setMessage(verificationError.message, true, 3);
        return;
      }
      clearOtpDigits();
      setMessage("E-posta doğrulandı. Giriş başarılı.", false, 3);
      redirectToHomeAfterAuth();
    });
  }

  if (resendVerifyCodeBtn) {
    updateResendButtonText(0);
    resendVerifyCodeBtn.addEventListener("click", async () => {
      const email = (verifyEmailEl?.value?.trim() || pendingVerificationEmail || "").toLowerCase();
      if (!email) {
        setMessage("Tekrar göndermek için e-posta bulunamadı.", true, 3);
        return;
      }
      updateVerifyMaskedEmail(email);
      resendVerifyCodeBtn.disabled = true;
      let error = null;
      if (pendingVerificationType === "email") {
        const emailOtpResult = await client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: authRedirectTo }
        });
        error = emailOtpResult.error;
      } else {
        const signupResult = await client.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: authRedirectTo }
        });
        error = signupResult.error;
      }
      if (error) {
        resendVerifyCodeBtn.disabled = false;
        const lowerMsg = String(error.message || "").toLowerCase();
        if (lowerMsg.includes("rate limit")) {
          setMessage("E-posta gonderim limiti dolu. Son gelen kodu kullanin veya biraz bekleyin.", true, 3);
          return;
        }
        setMessage(error.message, true, 3);
        return;
      }
      startResendCooldown();
      setMessage("Onay kodu tekrar gönderildi.", false, 3);
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

  client.auth.onAuthStateChange(async (_event, session) => {
    if (session && !isVerifiedSession(session)) {
      await client.auth.signOut();
      setMessage("E-posta dogrulama tamamlanmadan sisteme giris yapilamaz.", true, 2);
      showStep(1);
      return;
    }
    if (session && isDashboard && shouldRedirectToHomeAfterCallback()) {
      redirectToHomeAfterAuth();
      return;
    }
    setNavAuthUI(session);
    setDashboardUI(session);
  });

  client.auth.getSession().then(async ({ data }) => {
    if (data.session && !isVerifiedSession(data.session)) {
      await client.auth.signOut();
      setNavAuthUI(null);
      setDashboardUI(null);
      setMessage("E-posta dogrulama tamamlanmadan sisteme giris yapilamaz.", true, 2);
      showStep(1);
      return;
    }
    if (data.session && isDashboard && shouldRedirectToHomeAfterCallback()) {
      redirectToHomeAfterAuth();
      return;
    }
    setNavAuthUI(data.session);
    setDashboardUI(data.session);
    syncAuthModeText();
    if (!data.session && isDashboard) showStep(1);
  });
})();
