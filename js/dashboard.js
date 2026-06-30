// =====================================
// DASHBOARD
// =====================================

async function loadDashboard() {

    try {

        const user = JSON.parse(sessionStorage.getItem("user"));

        if (!user) {

            location.href = "login.html";

            return;

        }

        // =====================================
        // TOTAL MASTER BARANG
        // =====================================

        const {

            count: totalBarang

        } = await supabaseClient

            .from("master_barang")

            .select("*", {

                count: "exact",

                head: true

            });

        // =====================================
        // TOTAL MASTER KARYAWAN
        // =====================================

        const {

            count: totalKaryawan

        } = await supabaseClient

            .from("master_karyawan")

            .select("*", {

                count: "exact",

                head: true

            });

        // =====================================
        // TOTAL MUTASI KARYAWAN
        // =====================================

        const {

            count: totalMutasi

        } = await supabaseClient

            .from("mutasi_karyawan")

            .select("*", {

                count: "exact",

                head: true

            });

        // =====================================
        // TOTAL DEPARTEMEN
        // =====================================

        const {

            count: totalDepartemen

        } = await supabaseClient

            .from("master_departemen")

            .select("*", {

                count: "exact",

                head: true

            });

        // =====================================
        // TOTAL JABATAN
        // =====================================

        const {

            count: totalJabatan

        } = await supabaseClient

            .from("master_jabatan")

            .select("*", {

                count: "exact",

                head: true

            });

        // =====================================
        // TAMPILKAN DASHBOARD
        // =====================================

        if(document.getElementById("totalBarang"))
            document.getElementById("totalBarang").innerHTML =
                totalBarang ?? 0;

        if(document.getElementById("totalKaryawan"))
            document.getElementById("totalKaryawan").innerHTML =
                totalKaryawan ?? 0;

        if(document.getElementById("totalMutasi"))
            document.getElementById("totalMutasi").innerHTML =
                totalMutasi ?? 0;

        if(document.getElementById("totalDepartemen"))
            document.getElementById("totalDepartemen").innerHTML =
                totalDepartemen ?? 0;

        if(document.getElementById("totalJabatan"))
            document.getElementById("totalJabatan").innerHTML =
                totalJabatan ?? 0;

        // =====================================
        // USER LOGIN
        // =====================================

        if(document.getElementById("nama"))
            document.getElementById("nama").innerHTML =
                user.nama;

        if(document.getElementById("nama2"))
            document.getElementById("nama2").innerHTML =
                user.nama;

        if(document.getElementById("gudang"))
            document.getElementById("gudang").innerHTML =
                user.gudang;

        if(document.getElementById("gudang2"))
            document.getElementById("gudang2").innerHTML =
                user.gudang;

    }

    catch(err){

        console.error("Dashboard :", err);

    }

}

// =====================================
// LOGOUT
// =====================================

function logout(){

    sessionStorage.removeItem("user");

    location.href = "login.html";

}

// =====================================
// LOAD
// =====================================

document.addEventListener("DOMContentLoaded",function(){

    loadDashboard();

});
