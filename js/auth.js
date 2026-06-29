async function login() {

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const status = document.getElementById("status");

    status.innerHTML = "";

    try {

        const { data, error } = await supabaseClient
            .from("users")
            .select("*")
            .eq("username", username)
            .eq("password", password)
            .single();

        if (error || !data) {
            status.innerHTML = "Username atau Password salah";
            return;
        }

        localStorage.setItem("user", JSON.stringify(data));

        window.location.href = "dashboard.html";

    } catch (err) {

        console.error(err);

        status.innerHTML = "Tidak dapat terhubung ke database.";

    }

}
