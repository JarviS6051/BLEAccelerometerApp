export function base64ToBytes(b64: string): Uint8Array {
	const lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	let buffer = 0;
	let bits = 0;
	const out: number[] = [];

	for (let i = 0; i < b64.length; i++) {
		const c = b64.charAt(i);
		if (c === '=') break;
		const val = lookup.indexOf(c);
		if (val === -1) continue;
		buffer = (buffer << 6) | val;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			out.push((buffer >> bits) & 0xff);
		}
	}
	return new Uint8Array(out);
}


