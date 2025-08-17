import { createMikrotikPppoe, MikrotikPppoe } from "@/services/mikrotik/MikrotikPppoe";


(async () => {
	const pppoe = await createMikrotikPppoe(1);


	// 2️⃣ Inisialisasi data awal + mulai listen perubahan PPP active
	await pppoe.inActiveUsers();

	// 3️⃣ Pencarian PPP yang tidak aktif (langsung dari cache)
	console.log(pppoe.searchInactive("pp")); // → match semua ppp yang mengandung "pp"

	// 4️⃣ Bisa dipanggil kapan saja tanpa query ulang ke MikroTik
	// setInterval(() => {
	// 	const result = pppoe.searchInactive("pp");
	// 	console.log(`[${new Date().toLocaleTimeString()}] Inactive PPP:`, result);
	// }, 5000); // cek setiap 5 detik
})();
