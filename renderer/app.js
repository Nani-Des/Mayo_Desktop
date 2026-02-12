document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("loginBtn");

  loginBtn.addEventListener("click", async () => {
    const idCardInput = document.getElementById("idCard");
    const passwordInput = document.getElementById("password");

    if (!idCardInput || !passwordInput) {
      console.error("Login inputs not found!");
      return;
    }

    const idCard = idCardInput.value.trim();
    const password = passwordInput.value;

    if (!idCard || !password) {
      alert("Please fill all fields");
      console.log("Login attempt failed: empty fields");
      return;
    }

    try {
      console.log("Attempting login for ID:", idCard);

      const result = await window.api.login({ id_card: idCard, password });

      if (!result.success) {
        alert(result.message);
        console.log("Login failed:", result.message);
        return;
      }

      // ✅ Login successful
      alert(`Welcome, ${result.user.name}!`);
      console.log("Logged in user:", result.user);

    // Save logged-in user's name to localStorage
localStorage.setItem("loggedInUserName", result.user.name);

// Navigate to dashboard
window.location.href = "dashboard.html";

    } catch (err) {
      console.error("Error during login:", err);
      alert("An error occurred. Check console for details.");
    }
  });
});
