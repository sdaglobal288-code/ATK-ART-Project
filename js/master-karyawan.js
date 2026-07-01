// =====================================
// MASTER KARYAWAN
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;
let allKaryawan = [];

// =====================================
// MODAL HELPERS
// =====================================

function bukaModalTambah() {

    editId = null;
    form.reset();

    document.getElementById("nik").readOnly = false;
    document.getElementById("judulForm").innerHTML = "➕ Tambah Karyawan";
    document.getElementById("btnSimpan").innerHTML = "💾 Simpan Karyawan";

    document.getElementById("modalKaryawan").classList.add("active");
    document.getElementById("nik").focus();

}

function tutupModal() {

    document.getElementById("modalKaryawan").classList.remove("active");
    editId = null;
    form.reset();
    document.getElementById("nik").readOnly = false;

}

const modalEl = document.getElementById("modalKaryawan");
if (modalEl) {
    modalEl.addEventListener("click", e => { if (e.target === modalEl) tutupModal(); });
}

document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modalEl?.classList.contains("active")) tutupModal();
});

// =====================================
// LOAD DEPARTEMEN (dropdown form + filter)
// =====================================

async function loadDepartemen() {

    try {

        const { data, error } = await supabaseClient
            .from("master_departemen")
            .select("*")
            .order("nama_departemen");

        if (error) throw error;

        const selForm   = document.getElementById("departemen");
        const selFilter = document.getElementById("filterDept");

        selForm.innerHTML   = `<option value="">-- Pilih Departemen --</option>`;
        selFilter.innerHTML = `<option value="">Semua Departemen</option>`;

        (data || []).forEach(item => {
            selForm.innerHTML   += `<option value="${item.nama_departemen}">${item.nama_departemen}</option>`;
            selFilter.innerHTML += `<option value="${item.nama_departemen}">${item.nama_departemen}</option>`;
        });

    } catch (err) {
        console.error("Gagal memuat departemen:", err);
    }

}

// =====================================
// LOAD JABATAN (dropdown form)
// =====================================

async function loadJabatan() {

    try {

        const { data, error } = await supabaseClient
            .from("master_jabatan")
            .select("*")
            .order("nama_jabatan");

        if (error) throw error;

        const sel = document.getElementById("jabatan");
        sel.innerHTML = `<option value="">-- Pilih Jabatan --</option>`;

        (data || []).forEach(item => {
            sel.innerHTML += `<option value="${item.nama_jabatan}">${item.nama_jabatan}</option>`;
        });

    } catch (err) {
        console.error("Gagal memuat jabatan:", err);
    }

}

// =====================================
// LOAD KARYAWAN
// =====================================

async function loadKaryawan() {

    const tbody = document.querySelector("#tableKaryawan tbody");

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="loading-state">
                <span class="spinner"></span> Memuat data...
            </td>
        </tr>
    `;

    try {

        const { data, error } = await supabaseClient
            .from("master_karyawan")
            .select("*")
            .order("nik", { ascending: true });

        if (error) throw error;

        allKaryawan = data || [];
        applyFilter();

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

function renderKaryawan(list) {

    const tbody = document.querySelector("#tableKaryawan tbody");
    const totalBadge = document.getElementById("totalBadge");

    totalBadge.textContent = `${list.length} karyawan`;

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Tidak ada data karyawan yang cocok.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    list.forEach(item => {

        const badgeStatus = item.status === "Aktif"
            ? `<span class="badge-aktif">Aktif</span>`
            : `<span class="badge-nonaktif">Non Aktif</span>`;

        tbody.innerHTML += `
            <tr>
                <td><span class="nik-pill">${item.nik}</span></td>
                <td><strong>${item.nama}</strong></td>
                <td>${item.departemen ?? "-"}</td>
                <td>${item.jabatan ?? "-"}</td>
                <td>${badgeStatus}</td>
                <td>${item.created_by ?? "-"}</td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-edit" onclick="editKaryawan(${item.id})">✏ Edit</button>
                        <button class="btn-delete" onclick="hapusKaryawan(${item.id})">🗑 Hapus</button>
                    </div>
                </td>
            </tr>
        `;
    });

}

// =====================================
// SEARCH & FILTER
// =====================================

function applyFilter() {

    const keyword = (document.getElementById("searchKaryawan").value || "").trim().toLowerCase();
    const dept    = document.getElementById("filterDept").value;
    const status  = document.getElementById("filterStatus").value;

    const filtered = allKaryawan.filter(item => {

        const cocokKeyword =
            !keyword ||
            item.nik.toLowerCase().includes(keyword) ||
            item.nama.toLowerCase().includes(keyword);

        const cocokDept   = !dept   || item.departemen === dept;
        const cocokStatus = !status || item.status === status;

        return cocokKeyword && cocokDept && cocokStatus;

    });

    renderKaryawan(filtered);

}

document.getElementById("searchKaryawan").addEventListener("input", applyFilter);
document.getElementById("filterDept").addEventListener("change", applyFilter);
document.getElementById("filterStatus").addEventListener("change", applyFilter);

// =====================================
// SIMPAN / UPDATE KARYAWAN
// =====================================

const form = document.getElementById("formKaryawan");

if (form) {

    form.addEventListener("submit", async function (e) {

        e.preventDefault();

        const btnSimpan = document.getElementById("btnSimpan");
        const teksAsli  = btnSimpan.innerHTML;

        try {

            const nik        = document.getElementById("nik").value.trim().toUpperCase();
            const nama       = document.getElementById("nama").value.trim();
            const departemen = document.getElementById("departemen").value;
            const jabatan    = document.getElementById("jabatan").value;
            const status     = document.getElementById("status").value;

            if (!nik || !nama || !departemen || !jabatan) {
                alert("Semua field wajib diisi.");
                return;
            }

            btnSimpan.disabled = true;
            btnSimpan.innerHTML = "⏳ Menyimpan...";

            // ===== UPDATE =====
            if (editId !== null) {

                const { error } = await supabaseClient
                    .from("master_karyawan")
                    .update({ nama, departemen, jabatan, status })
                    .eq("id", editId);

                if (error) throw error;

                alert("Karyawan berhasil diupdate.");
                tutupModal();
                await loadKaryawan();
                return;

            }

            // ===== VALIDASI NIK DUPLIKAT =====
            const { data: cekNIK, error: errCek } = await supabaseClient
                .from("master_karyawan")
                .select("id")
                .eq("nik", nik);

            if (errCek) throw errCek;

            if (cekNIK && cekNIK.length > 0) {
                alert("NIK sudah digunakan.");
                return;
            }

            // ===== INSERT =====
            const { error } = await supabaseClient
                .from("master_karyawan")
                .insert([{ nik, nama, departemen, jabatan, status, created_by: user.nama }]);

            if (error) throw error;

            alert("Karyawan berhasil disimpan.");
            tutupModal();
            await loadKaryawan();

        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            btnSimpan.disabled = false;
            btnSimpan.innerHTML = editId !== null ? "💾 Update Karyawan" : teksAsli;
        }

    });

}

// =====================================
// EDIT KARYAWAN
// =====================================

async function editKaryawan(id) {

    try {

        const { data, error } = await supabaseClient
            .from("master_karyawan")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;

        editId = id;

        document.getElementById("nik").value         = data.nik;
        document.getElementById("nama").value        = data.nama;
        document.getElementById("departemen").value  = data.departemen;
        document.getElementById("jabatan").value     = data.jabatan;
        document.getElementById("status").value      = data.status;

        // NIK tidak boleh diubah saat edit
        document.getElementById("nik").readOnly = true;

        document.getElementById("judulForm").innerHTML  = "✏ Edit Karyawan";
        document.getElementById("btnSimpan").innerHTML  = "💾 Update Karyawan";

        document.getElementById("modalKaryawan").classList.add("active");
        document.getElementById("nama").focus();

    } catch (err) {
        console.error(err);
        alert(err.message);
    }

}

// =====================================
// HAPUS KARYAWAN
// =====================================

async function hapusKaryawan(id) {

    if (!confirm("Yakin ingin menghapus karyawan ini?")) return;

    try {

        const { error } = await supabaseClient
            .from("master_karyawan")
            .delete()
            .eq("id", id);

        if (error) throw error;

        alert("Karyawan berhasil dihapus.");
        await loadKaryawan();

    } catch (err) {
        console.error(err);
        alert(err.message);
    }

}

// =====================================
// EXPORT EXCEL
// =====================================

function exportExcel() {

    if (!allKaryawan.length) {
        alert("Tidak ada data untuk diexport.");
        return;
    }

    if (typeof XLSX === "undefined") {
        alert("Library SheetJS (xlsx) belum dimuat.");
        return;
    }

    const rows = allKaryawan.map(item => ({
        "NIK"        : item.nik,
        "NAMA"       : item.nama,
        "DEPARTEMEN" : item.departemen ?? "-",
        "JABATAN"    : item.jabatan ?? "-",
        "STATUS"     : item.status,
        "DIBUAT OLEH": item.created_by ?? "-"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Karyawan");

    const tanggal = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Master_Karyawan_${tanggal}.xlsx`);

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
                nik        : String(row.NIK ?? row.nik ?? "").trim().toUpperCase(),
                nama       : String(row.NAMA ?? row.nama ?? "").trim(),
                departemen : String(row.DEPARTEMEN ?? row.departemen ?? "").trim(),
                jabatan    : String(row.JABATAN ?? row.jabatan ?? "").trim(),
                status     : String(row.STATUS ?? row.status ?? "Aktif").trim(),
                created_by : user.nama
            })).filter(item => item.nik && item.nama);

            if (!payload.length) {
                alert("Tidak ada baris valid. Pastikan kolom NIK dan NAMA terisi.");
                return;
            }

            const { error } = await supabaseClient
                .from("master_karyawan")
                .upsert(payload, { onConflict: "nik" });

            if (error) throw error;

            alert(`${payload.length} karyawan berhasil diimport.`);
            await loadKaryawan();

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
    await Promise.all([ loadDepartemen(), loadJabatan() ]);
    await loadKaryawan();
});
