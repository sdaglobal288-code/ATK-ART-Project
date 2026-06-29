const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
    window.location.href = "login.html";
}

async function loadKategori() {

    const { data, error } = await supabaseClient
        .from("kategori_barang")
        .select("*")
        .order("nama_kategori");

    if (error) {
        console.error("Load Kategori :", error);
        return;
    }

    const kategori = document.getElementById("kategori");

    kategori.innerHTML = '<option value="">-- Pilih Kategori --</option>';

    data.forEach(item => {

        kategori.innerHTML += `
            <option value="${item.nama_kategori}">
                ${item.nama_kategori}
            </option>
        `;

    });

}

async function loadSatuan() {

    const { data, error } = await supabaseClient
        .from("satuan")
        .select("*")
        .order("nama_satuan");

    if (error) {
        console.error("Load Satuan :", error);
        return;
    }

    const satuan = document.getElementById("satuan");

    satuan.innerHTML = '<option value="">-- Pilih Satuan --</option>';

    data.forEach(item => {

        satuan.innerHTML += `
            <option value="${item.nama_satuan}">
                ${item.nama_satuan}
            </option>
        `;

    });

}

async function loadBarang() {

    const { data, error } = await supabaseClient
        .from("master_barang")
        .select("*")
        .eq("gudang", user.gudang)
        .order("kode_barang");

    if (error) {
        console.error("Load Barang :", error);
        return;
    }

    const tbody = document.querySelector("#tableBarang tbody");

    tbody.innerHTML = "";

    data.forEach(item => {

        tbody.innerHTML += `
        <tr>

            <td>${item.kode_barang}</td>

            <td>${item.nama_barang}</td>

            <td>${item.kategori}</td>

            <td>${item.satuan}</td>

            <td>${item.stok}</td>

            <td>

                <button onclick="editBarang(${item.id})">
                    ✏ Edit
                </button>

                <button onclick="hapusBarang(${item.id})">
                    🗑 Hapus
                </button>

            </td>

        </tr>
        `;

    });

}

document.getElementById("formBarang").addEventListener("submit", async function (e) {

    e.preventDefault();

    const barang = {

        kode_barang: document.getElementById("kode_barang").value.trim(),

        nama_barang: document.getElementById("nama_barang").value.trim(),

        kategori: document.getElementById("kategori").value,

        satuan: document.getElementById("satuan").value,

        stok: parseInt(document.getElementById("stok").value) || 0,

        stok_minimum: parseInt(document.getElementById("stok_minimum").value) || 0,

        gudang: user.gudang

    };

    const { error } = await supabaseClient
        .from("master_barang")
        .insert([barang]);

    if (error) {

        alert(error.message);

        return;

    }

    alert("Barang berhasil disimpan");

    document.getElementById("formBarang").reset();

    loadBarang();

});

async function hapusBarang(id) {

    if (!confirm("Hapus barang ini?")) return;

    const { error } = await supabaseClient
        .from("master_barang")
        .delete()
        .eq("id", id);

    if (error) {

        alert(error.message);

        return;

    }

    loadBarang();

}

function editBarang(id) {

    alert("Fitur Edit Barang akan kita buat pada tahap berikutnya.");

}

document.addEventListener("DOMContentLoaded", () => {

    loadKategori();

    loadSatuan();

    loadBarang();

});
