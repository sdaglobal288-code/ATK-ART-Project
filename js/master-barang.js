// =====================================
// MASTER BARANG
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId     = null;
let allBarang  = [];
let fotoFile   = null;    // file foto yang dipilih (belum diupload)
let fotoUrlLama = null;   // url foto yg sudah tersimpan saat mode edit

// Nama bucket Supabase Storage untuk foto barang
const FOTO_BUCKET = "barang-photos";

// =====================================
// FOTO PREVIEW HELPERS
// =====================================

function setFotoPreview(url) {

    const img         = document.getElementById("fotoPreviewImg");
    const placeholder = document.getElementById("fotoPlaceholder");
    const btnHapus    = document.getElementById("btnHapusFoto");

    if (url) {
        img.src = url;
        img.style.display = "block";
        placeholder.style.display = "none";
        btnHapus.classList.add("visible");
    } else {
        img.src = "";
        img.style.display = "none";
        placeholder.style.display = "flex";
        btnHapus.classList.remove("visible");
    }

}

function hapusFotoPreview() {

    fotoFile = null;
    fotoUrlLama = null;
    document.getElementById("inputFoto").value = "";
    setFotoPreview(null);

}

// Listener input foto
const inputFoto = document.getElementById("inputFoto");

if (inputFoto) {

    inputFoto.addEventListener("change", function () {

        const file = this.files[0];
        if (!file) return;

        // Validasi ukuran (maks 2 MB)
        if (file.size > 2 * 1024 * 1024) {
            alert("Ukuran foto maksimal 2 MB.");
            this.value = "";
            return;
        }

        // Validasi tipe
        if (!file.type.startsWith("image/")) {
            alert("File harus berupa gambar (JPG/PNG/WEBP).");
            this.value = "";
            return;
        }

        fotoFile = file;
        const reader = new FileReader();
        reader.onload = e => setFotoPreview(e.target.result);
        reader.readAsDataURL(file);

    });

}

// =====================================
// UPLOAD FOTO KE SUPABASE STORAGE
// =====================================

async function uploadFoto(kode) {

    if (!fotoFile) return fotoUrlLama;  // tidak ada file baru → kembalikan URL lama

    const ext  = fotoFile.name.split(".").pop().toLowerCase();
    const path = `${kode}.${ext}`;

    // Hapus file lama dulu jika ada (upsert storage)
    await supabaseClient.storage.from(FOTO_BUCKET).remove([path]);

    const { error } = await supabaseClient.storage
        .from(FOTO_BUCKET)
        .upload(path, fotoFile, { upsert: true, contentType: fotoFile.type });

    if (error) throw error;

    const { data: pub } = supabaseClient.storage
        .from(FOTO_BUCKET)
        .getPublicUrl(path);

    // Tambahkan cache-buster supaya update langsung terlihat
    return pub.publicUrl + "?t=" + Date.now();

}

// =====================================
// MODAL HELPERS
// =====================================

function bukaModalTambah() {

    editId = null;
    fotoFile = null;
    fotoUrlLama = null;
    form.reset();
    setFotoPreview(null);

    document.getElementById("kode_barang").readOnly = false;
    document.getElementById("judulForm").innerHTML = "➕ Tambah Barang";
    document.getElementById("btnSimpan").innerHTML = "💾 Simpan Barang";

    document.getElementById("modalBarang").classList.add("active");

}

function tutupModal() {

    document.getElementById("modalBarang").classList.remove("active");
    editId = null;
    fotoFile = null;
    fotoUrlLama = null;
    form.reset();
    setFotoPreview(null);
    document.getElementById("kode_barang").readOnly = false;

}

const modalBarangEl = document.getElementById("modalBarang");
if (modalBarangEl) {
    modalBarangEl.addEventListener("click", e => { if (e.target === modalBarangEl) tutupModal(); });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && modalBarangEl.classList.contains("active")) tutupModal();
    });
}

// =====================================
// LIGHTBOX
// =====================================

function bukaLightbox(url) {
    document.getElementById("lightboxImg").src = url;
    document.getElementById("lightbox").classList.add("active");
}

// =====================================
// LOAD KATEGORI
// =====================================

async function loadKategori() {

    try {

        const { data, error } = await supabaseClient
            .from("kategori_barang")
            .select("*")
            .order("nama_kategori");

        if (error) throw error;

        const sel = document.getElementById("kategori");
        sel.innerHTML = `<option value="">-- Pilih Kategori --</option>`;
        data.forEach(item => {
            sel.innerHTML += `<option value="${item.nama_kategori}">${item.nama_kategori}</option>`;
        });

    } catch (err) {
        console.error(err);
        alert(err.message);
    }

}

// =====================================
// LOAD SATUAN
// =====================================

async function loadSatuan() {

    try {

        const { data, error } = await supabaseClient
            .from("satuan")
            .select("*")
            .order("nama_satuan");

        if (error) throw error;

        const sel = document.getElementById("satuan");
        sel.innerHTML = `<option value="">-- Pilih Satuan --</option>`;
        data.forEach(item => {
            sel.innerHTML += `<option value="${item.nama_satuan}">${item.nama_satuan}</option>`;
        });

    } catch (err) {
        console.error(err);
        alert(err.message);
    }

}

// =====================================
// LOAD MASTER BARANG
// =====================================

async function loadBarang() {

    const tbody = document.querySelector("#tableBarang tbody");

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="loading-state">
                <span class="spinner"></span> Memuat data...
            </td>
        </tr>
    `;

    try {

        const { data, error } = await supabaseClient
            .from("master_barang")
            .select("*")
            .order("kode_barang");

        if (error) throw error;

        allBarang = data || [];
        renderBarang(allBarang);

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    ⚠ Gagal memuat data: ${err.message}
                </td>
            </tr>
        `;
    }

}

// =====================================
// RENDER TABEL
// =====================================

function renderBarang(list) {

    const tbody      = document.querySelector("#tableBarang tbody");
    const totalBadge = document.getElementById("totalBadge");

    totalBadge.textContent = `${list.length} item`;

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Tidak ada data barang yang cocok.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    list.forEach(item => {

        const fotoHtml = item.foto_url
            ? `<img src="${item.foto_url}" alt="${item.nama_barang}"
                    class="tbl-foto" loading="lazy"
                    onclick="bukaLightbox('${item.foto_url}')"
                    style="cursor:zoom-in;">`
            : `<div class="tbl-foto-empty">📦</div>`;

        tbody.innerHTML += `
            <tr>
                <td>${fotoHtml}</td>
                <td><span class="kode-pill">${item.kode_barang}</span></td>
                <td>${item.nama_barang}</td>
                <td>${item.kategori}</td>
                <td>${item.satuan}</td>
                <td>${item.created_by ?? "-"}</td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-edit" onclick="editBarang(${item.id})">✏ Edit</button>
                        <button class="btn-delete" onclick="hapusBarang(${item.id})">🗑 Hapus</button>
                    </div>
                </td>
            </tr>
        `;
    });

}

// =====================================
// SEARCH LOKAL
// =====================================

const searchInput = document.getElementById("searchBarang");

if (searchInput) {
    searchInput.addEventListener("input", function () {
        const keyword = this.value.trim().toLowerCase();
        const filtered = allBarang.filter(item =>
            item.kode_barang.toLowerCase().includes(keyword) ||
            item.nama_barang.toLowerCase().includes(keyword)
        );
        renderBarang(filtered);
    });
}

// =====================================
// SIMPAN / UPDATE BARANG
// =====================================

const form = document.getElementById("formBarang");

if (form) {

    form.addEventListener("submit", async function (e) {

        e.preventDefault();

        const btnSimpan = document.getElementById("btnSimpan");
        const teksAsli  = btnSimpan.innerHTML;

        try {

            const kode       = document.getElementById("kode_barang").value.trim().toUpperCase();
            const namaBarang = document.getElementById("nama_barang").value.trim();
            const kategoriVal = document.getElementById("kategori").value;
            const satuanVal   = document.getElementById("satuan").value;

            if (!kode || !namaBarang || !kategoriVal || !satuanVal) {
                alert("Semua field wajib diisi.");
                return;
            }

            btnSimpan.disabled = true;
            btnSimpan.innerHTML = "⏳ Menyimpan...";

            // Upload foto jika ada file baru
            const foto_url = await uploadFoto(kode);

            // ===== UPDATE =====
            if (editId !== null) {

                const updatePayload = {
                    nama_barang: namaBarang,
                    kategori: kategoriVal,
                    satuan: satuanVal
                };

                // Hanya update foto_url jika ada perubahan (ada file baru atau hapus foto)
                if (fotoFile !== null || fotoUrlLama === null) {
                    updatePayload.foto_url = foto_url ?? null;
                }

                const { error } = await supabaseClient
                    .from("master_barang")
                    .update(updatePayload)
                    .eq("id", editId);

                if (error) throw error;

                alert("Master Barang berhasil diupdate.");
                tutupModal();
                await loadBarang();
                return;

            }

            // ===== VALIDASI KODE DUPLIKAT =====
            const { data: cek, error: errCek } = await supabaseClient
                .from("master_barang")
                .select("id")
                .eq("kode_barang", kode);

            if (errCek) throw errCek;

            if (cek && cek.length > 0) {
                alert("Kode Barang sudah digunakan.");
                return;
            }

            // ===== INSERT =====
            const { error } = await supabaseClient
                .from("master_barang")
                .insert([{
                    kode_barang: kode,
                    nama_barang: namaBarang,
                    kategori: kategoriVal,
                    satuan: satuanVal,
                    foto_url: foto_url ?? null,
                    created_by: user.nama
                }]);

            if (error) throw error;

            alert("Master Barang berhasil disimpan.");
            tutupModal();
            await loadBarang();

        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            btnSimpan.disabled = false;
            btnSimpan.innerHTML = editId !== null ? "💾 Update Barang" : teksAsli;
        }

    });

}

// =====================================
// EDIT BARANG
// =====================================

async function editBarang(id) {

    try {

        const { data, error } = await supabaseClient
            .from("master_barang")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;

        editId = id;
        fotoFile = null;
        fotoUrlLama = data.foto_url ?? null;

        document.getElementById("kode_barang").value  = data.kode_barang;
        document.getElementById("nama_barang").value  = data.nama_barang;
        document.getElementById("kategori").value     = data.kategori;
        document.getElementById("satuan").value       = data.satuan;

        // Tampilkan foto yang ada
        setFotoPreview(fotoUrlLama);

        document.getElementById("kode_barang").readOnly = true;
        document.getElementById("judulForm").innerHTML  = "✏ Edit Barang";
        document.getElementById("btnSimpan").innerHTML  = "💾 Update Barang";

        document.getElementById("modalBarang").classList.add("active");

    } catch (err) {
        console.error(err);
        alert(err.message);
    }

}

// =====================================
// HAPUS BARANG
// =====================================

async function hapusBarang(id) {

    if (!confirm("Hapus Master Barang ini?")) return;

    try {

        // Cek apakah ada foto untuk dihapus dari storage
        const item = allBarang.find(b => b.id === id);
        if (item?.foto_url) {
            // Ekstrak path dari URL
            const url  = new URL(item.foto_url);
            const path = url.pathname.split(`/${FOTO_BUCKET}/`)[1]?.split("?")[0];
            if (path) {
                await supabaseClient.storage.from(FOTO_BUCKET).remove([path]);
            }
        }

        const { error } = await supabaseClient
            .from("master_barang")
            .delete()
            .eq("id", id);

        if (error) throw error;

        alert("Master Barang berhasil dihapus.");
        await loadBarang();

    } catch (err) {
        console.error(err);
        alert(err.message);
    }

}

// =====================================
// EXPORT EXCEL
// =====================================

function exportExcel() {

    if (!allBarang.length) {
        alert("Tidak ada data untuk diexport.");
        return;
    }

    if (typeof XLSX === "undefined") {
        alert("Library SheetJS (xlsx) belum dimuat. Tambahkan script SheetJS di <head>.");
        return;
    }

    const rows = allBarang.map((item, i) => ({
        "NO": i + 1,
        "KODE": item.kode_barang,
        "NAMA BARANG": item.nama_barang,
        "KATEGORI": item.kategori,
        "SATUAN": item.satuan,
        "FOTO URL": item.foto_url ?? "-",
        "DIBUAT OLEH": item.created_by ?? "-"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Barang");

    const tanggal = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Master_Barang_${tanggal}.xlsx`);

}

// =====================================
// IMPORT EXCEL
// =====================================

const fileImport = document.getElementById("fileImport");

if (fileImport) {

    fileImport.addEventListener("change", async function (e) {

        const file = e.target.files[0];
        if (!file) return;

        if (typeof XLSX === "undefined") {
            alert("Library SheetJS (xlsx) belum dimuat.");
            fileImport.value = "";
            return;
        }

        try {

            const buffer = await file.arrayBuffer();
            const wb     = XLSX.read(buffer, { type: "array" });
            const sheet  = wb.Sheets[wb.SheetNames[0]];
            const rows   = XLSX.utils.sheet_to_json(sheet);

            if (!rows.length) {
                alert("File kosong atau format tidak sesuai.");
                return;
            }

            const payload = rows.map(row => ({
                kode_barang: String(row.KODE ?? row.kode_barang ?? "").trim().toUpperCase(),
                nama_barang: String(row["NAMA BARANG"] ?? row.nama_barang ?? "").trim(),
                kategori: String(row.KATEGORI ?? row.kategori ?? "").trim(),
                satuan: String(row.SATUAN ?? row.satuan ?? "").trim(),
                created_by: user.nama
            })).filter(item => item.kode_barang && item.nama_barang);

            if (!payload.length) {
                alert("Tidak ada baris valid. Pastikan kolom KODE dan NAMA BARANG terisi.");
                return;
            }

            const { error } = await supabaseClient
                .from("master_barang")
                .upsert(payload, { onConflict: "kode_barang" });

            if (error) throw error;

            alert(`${payload.length} barang berhasil diimport.`);
            await loadBarang();

        } catch (err) {
            console.error(err);
            alert("Gagal import: " + err.message);
        } finally {
            fileImport.value = "";
        }

    });

}

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", async () => {
    await loadKategori();
    await loadSatuan();
    await loadBarang();
});
