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

export function bytesToBase64(bytes: Uint8Array): string {
	const lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	let out = '';
	let i = 0;

	for (; i + 2 < bytes.length; i += 3) {
		const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
		out +=
			lookup[(n >> 18) & 63] +
			lookup[(n >> 12) & 63] +
			lookup[(n >> 6) & 63] +
			lookup[n & 63];
	}

	const remain = bytes.length - i;
	if (remain === 1) {
		const n = bytes[i] << 16;
		out += lookup[(n >> 18) & 63] + lookup[(n >> 12) & 63] + '==';
	} else if (remain === 2) {
		const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
		out += lookup[(n >> 18) & 63] + lookup[(n >> 12) & 63] + lookup[(n >> 6) & 63] + '=';
	}

	return out;
}


