async function loadDashboard(){

    const { count, error } = await supabase
        .from("master_barang")
        .select("*", { count: "exact", head: true })
        .eq("gudang", user.gudang);

    if(error){
        console.error(error);
        return;
    }

    document.getElementById("totalBarang").innerHTML = count;

}

loadDashboard();
