import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
const svgPath = path.join(publicDir, 'IngeniumTechAcademyLogo.svg');

async function run() {
  if (!fs.existsSync(svgPath)) {
    console.error('SVG not found at:', svgPath);
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(svgPath);

  // 1. Generate Favicons: 16x16, 32x32, 48x48
  await sharp(svgBuffer)
    .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'favicon-16x16.png'));
  console.log('✓ favicon-16x16.png created');

  await sharp(svgBuffer)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  console.log('✓ favicon-32x32.png created');

  await sharp(svgBuffer)
    .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'favicon-48x48.png'));
  console.log('✓ favicon-48x48.png created');

  // favicon.ico (most browsers accept 32x32/48x48 PNG or ICO; creating 32x32/48x48 png fallback & standard ico)
  await sharp(svgBuffer)
    .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFormat('png')
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('✓ favicon.ico created');

  // 2. Apple Touch Icon: 180x180
  // Apple guidelines suggest non-transparent or opaque/clean background.
  // Standard brand dark backdrop #071D1A or clean white/black with padding, but transparent or dark fits best.
  // With transparent or subtle dark background, let's provide 180x180 with clean fit.
  await sharp(svgBuffer)
    .resize(180, 180, { fit: 'contain', background: { r: 10, g: 20, b: 20, alpha: 1 } })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png created');

  await sharp(svgBuffer)
    .resize(180, 180, { fit: 'contain', background: { r: 10, g: 20, b: 20, alpha: 1 } })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon-180x180.png'));
  console.log('✓ apple-touch-icon-180x180.png created');

  // 3. PWA Icons: 192x192, 512x512
  await sharp(svgBuffer)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('✓ icon-192.png created');

  await sharp(svgBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('✓ icon-512.png created');

  // Maskable 512x512 with safe zone (~10% padding on all sides)
  await sharp(svgBuffer)
    .resize(410, 410, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: { r: 7, g: 29, b: 26, alpha: 1 } // Brand dark backdrop
    })
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-512.png'));
  console.log('✓ icon-maskable-512.png created');

  // 4. Open Graph Social Share Image: 1200 x 630
  // Strict rules:
  // - Primary brand colors: White, Black, Official brand green (#0A9D8F)
  // - No yellow, blue, orange, purple, red, pink, gradients
  // - Contains official logo and appropriate Ingenium Tech Academy branding
  // - Exact logo artwork preserved

  // First render official logo at 360x360
  const ogLogoBuffer = await sharp(svgBuffer)
    .resize(360, 360, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Create SVG composite overlay with typography and clean solid styling in brand colors
  const ogOverlaySvg = `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="#0A0F11"/>
      
      <!-- Subtle brand frame lines -->
      <rect x="32" y="32" width="1136" height="566" rx="24" fill="none" stroke="#162B28" stroke-width="2"/>
      <rect x="48" y="48" width="1104" height="534" rx="16" fill="#0E1618"/>
      
      <!-- Brand Accent Bar -->
      <rect x="530" y="235" width="60" height="5" rx="2.5" fill="#0A9D8F"/>
      
      <!-- Brand Typography (White, Brand Green #0A9D8F, Subtle Gray/Black) -->
      <text x="530" y="285" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="900" fill="#FFFFFF" letter-spacing="1">
        INGENIUM
      </text>
      <text x="530" y="340" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="700" fill="#0A9D8F" letter-spacing="4">
        TECH ACADEMY
      </text>
      <text x="530" y="395" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="500" fill="#94A3B8" letter-spacing="0.5">
        Live Online Learning Platform
      </text>

      <!-- Badge Pill -->
      <rect x="530" y="425" width="230" height="38" rx="19" fill="#0A9D8F" fill-opacity="0.15" stroke="#0A9D8F" stroke-width="1.5"/>
      <text x="645" y="449" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#0A9D8F" letter-spacing="1" text-anchor="middle">
        OFFICIAL PLATFORM
      </text>
    </svg>
  `;

  await sharp(Buffer.from(ogOverlaySvg))
    .composite([
      {
        input: ogLogoBuffer,
        top: 135,
        left: 110,
      }
    ])
    .png()
    .toFile(path.join(publicDir, 'og-image.png'));
  console.log('✓ og-image.png created');

  console.log('All brand assets successfully generated from official Ingenium Tech Academy logo!');
}

run().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
