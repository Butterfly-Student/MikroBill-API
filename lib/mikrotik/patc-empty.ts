// patch-empty.ts  ➜  import di awal aplikasi Anda
import { Channel } from "node-routeros";

const _orig = (Channel as any).prototype.processPacket;

(Channel as any).prototype.processPacket = function (words: string[]) {
	if (words[0] === "!empty") {
		// abaikan saja; router akan mengirim !re ketika ada data sungguhan
		return;
	}
	// semua selain !empty diproses normal
	return _orig.call(this, words);
};
