// =====================================
// MASTER KARYAWAN
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

let editId = null;
let allKaryawan = [];
let allLevel  = [];   // dari master_level_jabatan (diurutkan menurut urutan level)
let allBagian = [];   // dari master_bagian (bisa terikat ke departemen)

const escAttr = s => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// =====================================
// MODAL HELPERS
// =====================================

function bukaModalTambah() {

    editId = null;
    form.reset();
    isiBagian("");

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
// LOAD AREA (dropdown form + filter)
async function loadArea() {
    try {
        const { data, error } = await supabaseClient
            .from("master_area").select("*").order("nama_area");
        if (error) throw error;
        const selForm = document.getElementById("area");
        const selFilter = document.getElementById("filterArea");
        selForm.innerHTML   = `<option value="">-- Pilih Area --</option>`;
        selFilter.innerHTML = `<option value="">Semua Area</option>`;
        (data || []).forEach(item => {
            selForm.innerHTML   += `<option value="${item.nama_area}">${item.nama_area}</option>`;
            selFilter.innerHTML += `<option value="${item.nama_area}">${item.nama_area}</option>`;
        });
    } catch (err) {
        console.error("Gagal memuat area:", err);
    }
}

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
// LOAD LEVEL & BAGIAN (dropdown form)
// Level = master_level_jabatan, Bagian = master_bagian (disaring menurut departemen yang dipilih)
// =====================================

// pilihan lama yang sudah tidak ada di master tetap ditampilkan agar tidak hilang diam-diam
function setSelectAman(id, nilai) {
    const sel = document.getElementById(id);
    if (nilai && ![...sel.options].some(o => o.value === nilai)) {
        sel.innerHTML += `<option value="${escAttr(nilai)}">${escAttr(nilai)}</option>`;
    }
    sel.value = nilai || "";
}

async function loadLevel() {
    try {
        const { data, error } = await supabaseClient
            .from("master_level_jabatan").select("*").order("urutan", { ascending: true });
        if (error) throw error;
        allLevel = data || [];
        const sel = document.getElementById("level");
        sel.innerHTML = `<option value="">-- Pilih Level --</option>` +
            allLevel.map(l => `<option value="${escAttr(l.nama_level)}">${escAttr(l.nama_level)}</option>`).join("");
    } catch (err) {
        console.error("Gagal memuat level:", err);
    }
}

async function loadBagian() {
    try {
        const { data, error } = await supabaseClient
            .from("master_bagian").select("*").order("nama_bagian");
        if (error) throw error;
        allBagian = data || [];
        isiBagian(document.getElementById("bagian").value);
    } catch (err) {
        console.error("Gagal memuat bagian (jalankan sql/master_bagian_schema.sql):", err);
    }
}

// Bagian yang tampil: milik departemen terpilih + bagian umum (tanpa departemen).
// pertahankanLama = true -> nilai yang sedang dipilih tetap ada walau bukan bagian departemen ini (mode edit)
function isiBagian(terpilih, pertahankanLama) {
    const dept = document.getElementById("departemen").value;
    const sel  = document.getElementById("bagian");
    const nama = [...new Set(
        allBagian.filter(b => !b.departemen || !dept || b.departemen === dept).map(b => b.nama_bagian)
    )];
    if (terpilih && pertahankanLama && !nama.includes(terpilih)) nama.push(terpilih);
    sel.innerHTML = `<option value="">-- Pilih Bagian --</option>` +
        nama.map(n => `<option value="${escAttr(n)}">${escAttr(n)}</option>`).join("");
    sel.value = nama.includes(terpilih) ? terpilih : "";
}

document.getElementById("departemen").addEventListener("change", () => {
    isiBagian(document.getElementById("bagian").value, false);   // ganti departemen -> bagian yang tidak cocok dikosongkan
});

// =====================================
// LOAD KARYAWAN
// =====================================

async function loadKaryawan() {

    const tbody = document.querySelector("#tableKaryawan tbody");

    tbody.innerHTML = `
        <tr>
            <td colspan="11" class="loading-state">
                <span class="spinner"></span> Memuat data...
            </td>
        </tr>
    `;

    try {

        const { data, error } = await supabaseClient
            .from("master_karyawan")
            .select("*")
            .order("tanggal_masuk", { ascending: true, nullsFirst: false });

        if (error) throw error;

        allKaryawan = data || [];
        applyFilter();

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="empty-state">
                    ⚠ Gagal memuat data: ${err.message}
                </td>
            </tr>
        `;
    }

}

// =====================================
// FORMAT TANGGAL (yyyy-mm-dd -> dd/mm/yyyy untuk tampilan tabel)
// =====================================

function formatTanggalTampil(tgl) {

    if (!tgl) return "-";

    try {

        const d = new Date(tgl);
        if (isNaN(d.getTime())) return "-";

        return d.toLocaleDateString("id-ID", {
            day: "2-digit", month: "2-digit", year: "numeric"
        });

    } catch (err) {
        return "-";
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
                <td colspan="11" class="empty-state">
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
                <td>${item.area ?? "-"}</td>
                <td>${item.jabatan ?? "-"}</td>
                <td>${item.level ?? "-"}</td>
                <td>${item.bagian ?? "-"}</td>
                <td>${formatTanggalTampil(item.tanggal_masuk)}</td>
                <td>${badgeStatus}</td>
                <td class="col-oleh">${item.created_by ?? "-"}</td>
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
        const areaFilter  = document.getElementById("filterArea")?.value || "";
        const cocokArea   = !areaFilter || item.area === areaFilter;
        const cocokStatus = !status || item.status === status;

        return cocokKeyword && cocokDept && cocokArea && cocokStatus;

    });

    renderKaryawan(filtered);

}

document.getElementById("searchKaryawan").addEventListener("input", applyFilter);
document.getElementById("filterDept").addEventListener("change", applyFilter);
document.getElementById("filterStatus").addEventListener("change", applyFilter);
document.getElementById("filterArea").addEventListener("change", applyFilter);

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

            const nik           = document.getElementById("nik").value.trim().toUpperCase();
            const nama          = document.getElementById("nama").value.trim();
            const departemen    = document.getElementById("departemen").value;
            const area          = document.getElementById("area").value || null;
            const jabatan       = document.getElementById("jabatan").value;
            const level         = document.getElementById("level").value || null;
            const bagian        = document.getElementById("bagian").value || null;
            const tanggalMasuk  = document.getElementById("tanggal_masuk").value || null;
            const status        = document.getElementById("status").value;

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
                    .update({ nama, departemen, area, jabatan, level, bagian, tanggal_masuk: tanggalMasuk, status })
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

            // ===== INSERT — gudang otomatis dari akun yang login =====
            const { error } = await supabaseClient
                .from("master_karyawan")
                .insert([{
                    nik,
                    nama,
                    departemen,
                    area,
                    jabatan,
                    level,
                    bagian,
                    tanggal_masuk : tanggalMasuk,
                    status,
                    gudang     : user.gudang,   // ← otomatis sesuai akun
                    created_by : user.nama
                }]);

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

        document.getElementById("nik").value          = data.nik;
        document.getElementById("nama").value         = data.nama;
        document.getElementById("departemen").value   = data.departemen;
        document.getElementById("area").value         = data.area ?? "";
        document.getElementById("jabatan").value      = data.jabatan;
        setSelectAman("level", data.level);
        isiBagian(data.bagian ?? "", true);   // departemen sudah terisi di atas, bagian disaring menurutnya
        document.getElementById("tanggal_masuk").value = data.tanggal_masuk
            ? String(data.tanggal_masuk).slice(0, 10)
            : "";
        document.getElementById("status").value       = data.status;

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
        "NIK"             : item.nik,
        "NAMA"            : item.nama,
        "DEPARTEMEN"      : item.departemen ?? "-",
        "AREA"            : item.area ?? "-",
        "JABATAN"         : item.jabatan ?? "-",
        "LEVEL"           : item.level ?? "-",
        "BAGIAN"          : item.bagian ?? "-",
        "TANGGAL BERGABUNG": item.tanggal_masuk ?? "-",
        "STATUS"          : item.status,
        "GUDANG"          : item.gudang ?? "-",
        "DIBUAT OLEH"     : item.created_by ?? "-"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Karyawan");

    const tanggal = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Master_Karyawan_${tanggal}.xlsx`);

}

// =====================================
// IMPORT EXCEL — karyawan baru masuk ke gudang akun yang login; karyawan milik gudang lain tidak diubah
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

            // Kolom LEVEL / BAGIAN hanya diproses bila ada di file, supaya import file lama tidak mengosongkan data yang sudah ada
            const adaLevel  = rows.some(r => "LEVEL"  in r || "level"  in r);
            const adaBagian = rows.some(r => "BAGIAN" in r || "bagian" in r);
            const samakan = (nilai, daftar, kolom) => {
                const v = String(nilai ?? "").trim();
                if (!v || v === "-") return null;
                return daftar.find(x => String(x[kolom]).toLowerCase() === v.toLowerCase())?.[kolom] ?? v;
            };

            const payload = rows.map(row => {

                // Tanggal bergabung bisa berupa serial number Excel atau teks tanggal
                let tanggalMasuk = row["TANGGAL BERGABUNG"] ?? row.tanggal_masuk ?? null;

                if (tanggalMasuk instanceof Date) {
                    tanggalMasuk = tanggalMasuk.toISOString().slice(0, 10);
                } else if (typeof tanggalMasuk === "number") {
                    // serial date Excel -> JS Date
                    const parsed = XLSX.SSF.parse_date_code(tanggalMasuk);
                    if (parsed) {
                        const mm = String(parsed.m).padStart(2, "0");
                        const dd = String(parsed.d).padStart(2, "0");
                        tanggalMasuk = `${parsed.y}-${mm}-${dd}`;
                    } else {
                        tanggalMasuk = null;
                    }
                } else if (typeof tanggalMasuk === "string" && tanggalMasuk.trim() !== "" && tanggalMasuk !== "-") {
                    tanggalMasuk = tanggalMasuk.trim();
                } else {
                    tanggalMasuk = null;
                }

                return {
                    nik           : String(row.NIK ?? row.nik ?? "").trim().toUpperCase(),
                    nama          : String(row.NAMA ?? row.nama ?? "").trim(),
                    departemen    : String(row.DEPARTEMEN ?? row.departemen ?? "").trim(),
                    area          : String(row.AREA ?? row.area ?? "").trim() || null,
                    jabatan       : String(row.JABATAN ?? row.jabatan ?? "").trim(),
                    ...(adaLevel  ? { level  : samakan(row.LEVEL  ?? row.level,  allLevel,  "nama_level")  } : {}),
                    ...(adaBagian ? { bagian : samakan(row.BAGIAN ?? row.bagian, allBagian, "nama_bagian") } : {}),
                    tanggal_masuk : tanggalMasuk,
                    status        : String(row.STATUS ?? row.status ?? "Aktif").trim(),
                    gudang        : user.gudang,   // ← otomatis sesuai akun, abaikan kolom gudang di file
                    created_by    : user.nama
                };

            }).filter(item => item.nik && item.nama);

            if (!payload.length) {
                alert("Tidak ada baris valid. Pastikan kolom NIK dan NAMA terisi.");
                return;
            }

            // nilai level / bagian yang tidak ada di master ditandai agar tidak masuk diam-diam
            const lvAda = new Set(allLevel.map(l => l.nama_level.toLowerCase()));
            const bgAda = new Set(allBagian.map(b => b.nama_bagian.toLowerCase()));
            const asing = [...new Set(payload.flatMap(p => [
                p.level  && !lvAda.has(p.level.toLowerCase())  ? "Level: "  + p.level  : null,
                p.bagian && !bgAda.has(p.bagian.toLowerCase()) ? "Bagian: " + p.bagian : null
            ]).filter(Boolean))];
            if (asing.length && !confirm(`${asing.length} nilai tidak ada di master:\n${asing.slice(0, 10).join("\n")}\n\nTetap import? (tambahkan dulu di Master Level / Master Bagian bila perlu)`)) return;

            // ===== LINDUNGI GUDANG =====
            // NIK yang sudah ada dan milik gudang lain TIDAK disentuh (gudang & "dibuat oleh" tidak pernah ditimpa).
            // Pindah gudang dilakukan lewat Mutasi Karyawan, bukan lewat import.
            const gd = user.gudang || null;
            const sudahAda = {};
            for (let dari = 0; ; dari += 1000) {
                const { data, error: errAda } = await supabaseClient
                    .from("master_karyawan").select("nik, gudang").range(dari, dari + 999);
                if (errAda) throw errAda;
                data.forEach(r => { sudahAda[String(r.nik).toUpperCase()] = r.gudang || null; });
                if (data.length < 1000) break;
            }

            // NIK dobel di dalam file: pakai baris terakhir
            const unik = [...new Map(payload.map(p => [p.nik, p])).values()];

            const baru = [], ubah = [], klaim = [], lewat = [];
            unik.forEach(p => {
                const { gudang: _g, created_by: _c, ...sisa } = p;     // kolom data saja, tanpa gudang / created_by
                if (!(p.nik in sudahAda))                          baru.push(p);                       // NIK baru -> masuk gudang akun ini
                else if (!sudahAda[p.nik] && gd)                   klaim.push({ ...sisa, gudang: gd });  // belum punya gudang -> diambil akun ini
                else if (!gd || sudahAda[p.nik] === gd)            ubah.push(sisa);                    // milik gudang ini -> perbarui data saja
                else                                               lewat.push({ nik: p.nik, nama: p.nama, gudang: sudahAda[p.nik] });
            });

            let pesan = `Ringkasan import ke gudang ${gd || "(akun tanpa gudang)"}:\n• Karyawan baru: ${baru.length}\n• Diperbarui: ${ubah.length + klaim.length}\n• Dilewati (milik gudang lain): ${lewat.length}`;
            if (lewat.length) {
                pesan += `\n\nDilewati, contoh:\n` + lewat.slice(0, 8).map(x => `${x.nik} ${x.nama} (${x.gudang})`).join("\n")
                      + (lewat.length > 8 ? `\n... dan ${lewat.length - 8} lainnya` : "")
                      + `\n\nUntuk memindahkan karyawan antar gudang, gunakan Mutasi Karyawan.`;
            }
            if (!baru.length && !ubah.length && !klaim.length) {
                alert(pesan + "\n\nTidak ada data yang diimport.");
                return;
            }
            if (!confirm(pesan + "\n\nLanjutkan import?")) return;

            // tiap kelompok dikirim terpisah agar bentuk datanya seragam (kolom yang tidak dikirim tidak ikut ditimpa)
            for (const kelompok of [baru, ubah, klaim]) {
                if (!kelompok.length) continue;
                const { error } = await supabaseClient.from("master_karyawan").upsert(kelompok, { onConflict: "nik" });
                if (error) throw error;
            }

            alert(`Import selesai: ${baru.length} karyawan baru, ${ubah.length + klaim.length} diperbarui, ${lewat.length} dilewati.`);
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
    await Promise.all([ loadDepartemen(), loadJabatan(), loadArea(), loadLevel(), loadBagian() ]);
    await loadKaryawan();
});
