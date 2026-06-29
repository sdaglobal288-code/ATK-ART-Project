// =====================================
// DASHBOARD
// =====================================

async function loadDashboard() {

    try {

        // Ambil user dari session
        const user = JSON.parse(sessionStorage.getItem("user"));

        if (!user) {

            window.location.href = "login.html";

            return;

        }

        // =============================
        // TOTAL MASTER BARANG
        // =============================

        const {

            count: totalBarang,

            error

        } = await supabaseClient
            .from("master_barang")
            .select("*", {

                count: "exact",

                head: true

            });

        if (error) {

            console.error(error);

            return;

        }

        document.getElementById("totalBarang").innerHTML =
            totalBarang || 0;

        // =============================
        // USER LOGIN
        // =============================

        document.getElementById("nama").innerHTML =
            user.nama;

        document.getElementById("nama2").innerHTML =
            user.nama;

        document.getElementById("gudang").innerHTML =
            user.gudang;

        document.getElementById("gudang2").innerHTML =
            user.gudang;

    } catch (err) {

        console.error("Dashboard :", err);

    }

}

// =====================================
// LOGOUT
// =====================================

function logout() {

    sessionStorage.removeItem("user");

    location.href = "login.html";

}

// =====================================

document.addEventListener("DOMContentLoaded", () => {

    loadDashboard();

});
