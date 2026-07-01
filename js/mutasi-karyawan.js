// =====================================
// MUTASI KARYAWAN
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let karyawanAktif = null;   // data karyawan yang sedang dicari
let allMutasi = [];

// =====================================
// LOAD DROPDOWN DEPARTEMEN
// =====================================

async function loadDepartemen() {

    try {

        const { data, error } = await supabaseClient
            .from("master_departemen")
            .select("*")
            .order("nama_departemen");

        if (error) throw error;

        const sel = document.getElementById("departemen_baru");
        sel.innerHTML = `<option value="">-- Pilih Departemen --</option>`;

        (data || []).forEach(item => {
            sel.innerHTML += `<option value="${item.nama_departemen}">${item.nama_departemen}</option>`;
        });

    } catch (err) {
        console.error("Gagal memuat departemen:", err);
    }

}

// =====================================
// LOAD DROPDOWN JABATAN
// =====================================

async function loadJabatan() {

    try {

        const { data, error } = await supabaseClient
            .from("master_jabatan")
            .select("*")
            .order("nama_jabatan");

        if (error) throw error;

        const sel = document.getElementById("jabatan_baru");
        sel.innerHTML = `<option value="">-- Pilih Jabatan --</option>`;

        (data || []).forEach(item => {
            sel.innerHTML += `<option value="${item.nama_jabatan}">${item.nama_jabatan}</option>`;
        });

    } catch (err) {
        console.error("Gagal memuat jabatan:", err);
    }

}

// =====================================
// CARI KARYAWAN BERDASARKAN NIK
// =====================================

async function cariKaryawan() {

    const nik = document.getElementById("nik").value.trim().toUpperCase();

    if (!nik) {
        alert("Masukkan NIK terlebih dahulu.");
        document.getElementById("nik").focus();
        return;
    }

    const btnCari = document.getElementById("btnCari");
    btnCari.disabled = true;
    btnCari.textContent = "🔍 Mencari...";

    // Reset state
    resetDataLama();
    document.getElementById("btnSimpan").disabled = true;

    try {

        const { data, error } = await supabaseClient
            .from("master_karyawan")
            .select("*")
            .eq("nik", nik)
            .single();

        if (error || !data) {
            alert(`Karyawan dengan NIK "${nik}" tidak ditemukan.`);
            return;
        }

        karyawanAktif = data;

        // Isi field data lama
        document.getElementById("nama").value           = data.nama;
        document.getElementById("gudang_lama").value    = data.gudang ?? "-";
        document.getElementById("departemen_lama").value = data.departemen ?? "-";
        document.getElementById("jabatan_lama").value   = data.jabatan ?? "-";

        // Aktifkan tombol simpan
        document.getElementById("btnSimpan").disabled = false;

    } catch (err) {
        console.error(err);
        alert("Gagal mencari karyawan: " + err.message);
    } finally {
        btnCari.disabled = false;
        btnCari.textContent = "🔍 Cari";
    }

}

function resetDataLama() {
    ["nama", "gudang_lama", "departemen_lama", "jabatan_lama"].forEach(id => {
        document.getElementById(id).value = "";
    });
    karyawanAktif = null;
}

// Enter di NIK field langsung cari
document.getElementById("nik").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        e.preventDefault();
        cariKaryawan();
    }
});

// =====================================
// SIMPAN MUTASI
// =====================================

const form = document.getElementById("formMutasi");

if (form) {

    form.addEventListener("submit", async function (e) {

        e.preventDefault();

        if (!karyawanAktif) {
            alert("Cari karyawan terlebih dahulu.");
            return;
        }

        const gudangBaru     = document.getElementById("gudang_baru").value;
        const departemenBaru = document.getElementById("departemen_baru").value;
        const jabatanBaru    = document.getElementById("jabatan_baru").value;
        const keterangan     = document.getElementById("keterangan").value.trim();

        if (!gudangBaru || !departemenBaru || !jabatanBaru) {
            alert("Pilih Gudang, Departemen, dan Jabatan tujuan terlebih dahulu.");
            return;
        }

        // Cek apakah ada perubahan sama sekali
        const tidakAdaPerubahan =
            gudangBaru === (karyawanAktif.gudang ?? "") &&
            departemenBaru === (karyawanAktif.departemen ?? "") &&
            jabatanBaru === (karyawanAktif.jabatan ?? "");

        if (tidakAdaPerubahan) {
            alert("Tidak ada perubahan pada data karyawan.");
            return;
        }

        const btnSimpan = document.getElementById("btnSimpan");
        btnSimpan.disabled = true;
        btnSimpan.innerHTML = "⏳ Menyimpan...";

        try {

            // 1. Simpan record mutasi ke tabel riwayat
            const { error: errMutasi } = await supabaseClient
                .from("mutasi_karyawan")
                .insert([{
                    nik              : karyawanAktif.nik,
                    nama             : karyawanAktif.nama,
                    gudang_lama      : karyawanAktif.gudang    ?? "-",
                    departemen_lama  : karyawanAktif.departemen ?? "-",
                    jabatan_lama     : karyawanAktif.jabatan   ?? "-",
                    gudang_baru      : gudangBaru,
                    departemen_baru  : departemenBaru,
                    jabatan_baru     : jabatanBaru,
                    keterangan       : keterangan || null,
                    created_by       : user.nama,
                    tanggal_mutasi   : new Date().toISOString()
                }]);

            if (errMutasi) throw errMutasi;

            // 2. Update data karyawan di master_karyawan
            const { error: errUpdate } = await supabaseClient
                .from("master_karyawan")
                .update({
                    gudang     : gudangBaru,
                    departemen : departemenBaru,
                    jabatan    : jabatanBaru
                })
                .eq("id", karyawanAktif.id);

            if (errUpdate) throw errUpdate;

            alert(`Mutasi karyawan ${karyawanAktif.nama} berhasil disimpan.`);

            // Reset form
            form.reset();
            resetDataLama();
            document.getElementById("btnSimpan").disabled = true;

            await loadRiwayat();

        } catch (err) {
            console.error(err);
            alert("Gagal menyimpan mutasi: " + err.message);
        } finally {
            btnSimpan.disabled = false;
            btnSimpan.innerHTML = "💾 Simpan Mutasi";
        }

    });

}

// =====================================
// LOAD RIWAYAT MUTASI
// =====================================

async function loadRiwayat() {

    const tbody = document.querySelector("#tableMutasi tbody");

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="loading-state">
                <span class="spinner"></span> Memuat riwayat...
            </td>
        </tr>
    `;

    try {

        const { data, error } = await supabaseClient
            .from("mutasi_karyawan")
            .select("*")
            .order("tanggal_mutasi", { ascending: false });

        if (error) throw error;

        allMutasi = data || [];

        const totalBadge = document.getElementById("totalBadge");
        totalBadge.textContent = `${allMutasi.length} data`;

        if (allMutasi.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        Belum ada riwayat mutasi.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = "";

        allMutasi.forEach(item => {

            const dari = [item.gudang_lama, item.departemen_lama, item.jabatan_lama]
                .filter(v => v && v !== "-").join(" · ");

            const ke = [item.gudang_baru, item.departemen_baru, item.jabatan_baru]
                .filter(v => v && v !== "-").join(" · ");

            const tanggal = item.tanggal_mutasi
                ? new Date(item.tanggal_mutasi).toLocaleDateString("id-ID", {
                    day:"2-digit", month:"short", year:"numeric"
                  })
                : "-";

            tbody.innerHTML += `
                <tr>
                    <td><span class="nik-pill">${item.nik}</span></td>
                    <td><strong>${item.nama}</strong></td>
                    <td style="color:var(--mu-muted);font-size:13px;">${dari || "-"}</td>
                    <td style="font-size:13px;">${ke || "-"}</td>
                    <td style="color:var(--mu-muted);font-size:13px;">${item.keterangan ?? "-"}</td>
                    <td style="color:var(--mu-muted);font-size:13px;white-space:nowrap;">${tanggal}</td>
                    <td style="color:var(--mu-muted);font-size:13px;">${item.created_by ?? "-"}</td>
                </tr>
            `;
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    ⚠ Gagal memuat riwayat: ${err.message}
                </td>
            </tr>
        `;
    }

}

// =====================================
// EXPORT EXCEL RIWAYAT
// =====================================

function exportExcel() {

    if (!allMutasi.length) {
        alert("Tidak ada riwayat untuk diexport.");
        return;
    }

    if (typeof XLSX === "undefined") {
        alert("Library SheetJS (xlsx) belum dimuat.");
        return;
    }

    const rows = allMutasi.map(item => ({
        "NIK"             : item.nik,
        "NAMA"            : item.nama,
        "GUDANG LAMA"     : item.gudang_lama ?? "-",
        "DEPARTEMEN LAMA" : item.departemen_lama ?? "-",
        "JABATAN LAMA"    : item.jabatan_lama ?? "-",
        "GUDANG BARU"     : item.gudang_baru ?? "-",
        "DEPARTEMEN BARU" : item.departemen_baru ?? "-",
        "JABATAN BARU"    : item.jabatan_baru ?? "-",
        "KETERANGAN"      : item.keterangan ?? "-",
        "TANGGAL"         : item.tanggal_mutasi
            ? new Date(item.tanggal_mutasi).toLocaleDateString("id-ID")
            : "-",
        "DIBUAT OLEH"     : item.created_by ?? "-"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Riwayat Mutasi");

    const tanggal = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Riwayat_Mutasi_${tanggal}.xlsx`);

}

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", async () => {
    await Promise.all([ loadDepartemen(), loadJabatan() ]);
    await loadRiwayat();
});
