async function loadDashboard() {

    try {

        const user = JSON.parse(localStorage.getItem("user"));

        if (!user) {
            window.location.href = "login.html";
            return;
        }

        const { count, error } = await supabaseClient
            .from("master_barang")
            .select("*", {
                count: "exact",
                head: true
            })
            .eq("gudang", user.gudang);

        if (error) {
            console.error("Dashboard Error :", error);
            return;
        }

        const totalBarang = document.getElementById("totalBarang");

        if (totalBarang) {
            totalBarang.innerHTML = count ?? 0;
        }

    } catch (err) {

        console.error("Load Dashboard :", err);

    }

}

document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
});
