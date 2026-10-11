/**
 * One-off fix: product prices saved without their last three zeros (₩48 instead of ₩48,000).
 *
 *   npm run fix:prices            → only shows what would change (nothing is written)
 *   npm run fix:prices -- --apply → multiplies those values by 1,000
 *
 * Only values between 1 and 999 are touched, so running it twice changes nothing the second time.
 * Orders are left alone: they keep the price that was actually paid.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const LIMIT = 1000;
const FIELDS = ['productPrice', 'productSalePrice', 'productDeliveryFee'];

const readEnv = () => {
	const file = path.join(__dirname, '..', '.env');
	if (!fs.existsSync(file)) return {};
	return Object.fromEntries(
		fs
			.readFileSync(file, 'utf8')
			.split('\n')
			.map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/))
			.filter(Boolean)
			.map(([, key, value]) => [key, value.replace(/^['"]|['"]$/g, '')]),
	);
};

const won = (value) => `₩${Number(value).toLocaleString('en-US')}`;

(async () => {
	const env = { ...readEnv(), ...process.env };
	const uri = env.NODE_ENV === 'production' ? env.MONGO_PROD : env.MONGO_DEV;
	if (!uri) throw new Error('MONGO_DEV / MONGO_PROD is missing in .env');

	await mongoose.connect(uri);
	const products = mongoose.connection.db.collection('products');

	const tooSmall = { $gt: 0, $lt: LIMIT };
	const rows = await products
		.find(
			{ $or: FIELDS.map((field) => ({ [field]: tooSmall })) },
			{ projection: { productTitle: 1, productPrice: 1, productSalePrice: 1, productDeliveryFee: 1 } },
		)
		.toArray();

	if (!rows.length) {
		console.log('All prices look right. Nothing to fix.');
		return;
	}

	const ops = rows.map((row) => {
		const mul = {};
		const changes = [];
		for (const field of FIELDS) {
			const value = row[field];
			if (typeof value === 'number' && value > 0 && value < LIMIT) {
				mul[field] = 1000;
				changes.push(`${field.replace('product', '')}: ${won(value)} → ${won(value * 1000)}`);
			}
		}
		console.log(`- ${row.productTitle}  |  ${changes.join('  |  ')}`);
		/* the filter repeats the check, so a value that changed in between is not multiplied twice */
		const filter = { _id: row._id, $and: Object.keys(mul).map((field) => ({ [field]: tooSmall })) };
		return { updateOne: { filter, update: { $mul: mul } } };
	});

	console.log(`\n${rows.length} product(s) have prices under ₩${LIMIT.toLocaleString('en-US')}.`);
	if (!APPLY) {
		console.log('Nothing was changed. Run again with --apply to fix them:  npm run fix:prices -- --apply');
		return;
	}
	const result = await products.bulkWrite(ops, { ordered: false });
	console.log(`Fixed ${result.modifiedCount} product(s).`);
})()
	.catch((err) => {
		console.error('ERROR:', err.message);
		process.exitCode = 1;
	})
	.finally(() => mongoose.disconnect());
