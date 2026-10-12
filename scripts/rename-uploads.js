/**
 * One-off: give the upload folders names that say what is inside.
 *
 *   uploads/article → uploads/community     (photos in community posts and room tours)
 *   uploads/lens    → uploads/photo-search  (temporary photo-search uploads)
 *
 *   npm run uploads:rename            → shows what would change (nothing is moved or written)
 *   npm run uploads:rename -- --apply → moves the files on THIS machine and updates the paths in the database
 *
 * Run it on every machine that has an uploads folder (the server and your laptop).
 * The database part runs once; on the second machine it finds nothing left to change.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const ROOT = path.join(__dirname, '..', 'uploads');
const MOVES = [
	['article', 'community'],
	['lens', 'photo-search'],
];
const OLD_PREFIX = 'uploads/article/';
const NEW_PREFIX = 'uploads/community/';

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

const moveFolders = () => {
	for (const [from, to] of MOVES) {
		const source = path.join(ROOT, from);
		if (!fs.existsSync(source)) {
			console.log(`uploads/${from}: not here, nothing to move`);
			continue;
		}
		const target = path.join(ROOT, to);
		const files = fs.readdirSync(source);
		console.log(`uploads/${from} → uploads/${to}: ${files.length} file(s)`);
		if (!APPLY) continue;
		fs.mkdirSync(target, { recursive: true });
		for (const name of files) fs.renameSync(path.join(source, name), path.join(target, name));
		fs.rmdirSync(source);
	}
};

const swap = (value) => (typeof value === 'string' && value.startsWith(OLD_PREFIX) ? NEW_PREFIX + value.slice(OLD_PREFIX.length) : value);

const updateDatabase = async () => {
	const env = { ...readEnv(), ...process.env };
	const uri = env.NODE_ENV === 'production' ? env.MONGO_PROD : env.MONGO_DEV;
	if (!uri) throw new Error('MONGO_DEV / MONGO_PROD is missing in .env');
	await mongoose.connect(uri);
	const articles = mongoose.connection.db.collection('boardArticles');
	const old = new RegExp(`^${OLD_PREFIX}`);
	const rows = await articles
		.find({ $or: [{ articleImage: old }, { roomImages: old }] }, { projection: { articleImage: 1, roomImages: 1 } })
		.toArray();
	console.log(`database: ${rows.length} post(s) still point at ${OLD_PREFIX}`);
	if (!APPLY || !rows.length) return;
	const ops = rows.map((row) => {
		/* only the fields that really change are written */
		const set = {};
		if (swap(row.articleImage) !== row.articleImage) set.articleImage = swap(row.articleImage);
		if ((row.roomImages ?? []).some((image) => swap(image) !== image)) set.roomImages = row.roomImages.map(swap);
		return { updateOne: { filter: { _id: row._id }, update: { $set: set } } };
	});
	const result = await articles.bulkWrite(ops, { ordered: false });
	console.log(`database: updated ${result.modifiedCount} post(s)`);
};

(async () => {
	moveFolders();
	await updateDatabase();
	if (!APPLY) console.log('\nNothing was changed. Run again with --apply:  npm run uploads:rename -- --apply');
})()
	.catch((err) => {
		console.error('ERROR:', err.message);
		process.exitCode = 1;
	})
	.finally(() => mongoose.disconnect());
