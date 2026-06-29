// =====================================
// LOGIN
// =====================================

async function login() {

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    const status = document.getElementById("status");
    const btnLogin = document.getElementById("btnLogin");

    status.innerHTML = "";

    if (username === "" || password === "") {

        status.innerHTML = "Username dan Password wajib diisi.";

        return;

    }

    btnLogin.disabled = true;
    btnLogin.innerHTML = "LOADING...";

    try {

        const { data, error } = await supabaseClient
            .from("users")
            .select("*")
            .eq("username", username)
            .eq("password", password)
            .single();

        if (error || !data) {

            status.innerHTML = "Username atau Password salah.";

            btnLogin.disabled = false;
            btnLogin.innerHTML = "LOGIN";

            return;

        }

        // Simpan user hanya untuk TAB ini
        sessionStorage.setItem("user", JSON.stringify(data));

        window.location.href = "dashboard.html";

    } catch (err) {

        console.error(err);

        status.innerHTML = "Tidak dapat terhubung ke database.";

        btnLogin.disabled = false;
        btnLogin.innerHTML = "LOGIN";

    }

}

// =====================================
// ENTER UNTUK LOGIN
// =====================================

document.addEventListener("DOMContentLoaded", () => {

    const username = document.getElementById("username");
    const password = document.getElementById("password");

    username.focus();

    username.addEventListener("keypress", function (e) {

        if (e.key === "Enter") {

            login();

        }

    });

    password.addEventListener("keypress", function (e) {

        if (e.key === "Enter") {

            login();

        }

    });

});
