import fs from 'fs';
import path from 'path';

const src = "C:\\Users\\Lenovo\\.gemini\\antigravity\\brain\\57f7058b-e98a-468a-9e78-4935a1cc2b93\\new_login_banner_1781671595953.png";
const dest = path.join(process.cwd(), "public", "banner.jpg");

try {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log("Successfully copied banner!");
  } else {
    console.log("Banner source not found, skipping copy. Using existing banner.");
  }
} catch (err) {
  console.error("Error copying banner:", err);
}
