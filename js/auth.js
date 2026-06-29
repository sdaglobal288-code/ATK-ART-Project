async function login(){

const username=document.getElementById("username").value;

const password=document.getElementById("password").value;

const status=document.getElementById("status");

status.innerHTML="";

const {data,error}=await supabase

.from("users")

.select("*")

.eq("username",username)

.eq("password",password)

.single();

if(error){

status.innerHTML="Username atau Password salah";

return;

}

localStorage.setItem("user",JSON.stringify(data));

location.href="dashboard.html";

}
