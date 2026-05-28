import { PKPass } from 'passkit-generator'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PASSES_DIR = join(__dirname, '../../passes')

// ── GENERATE A .pkpass FILE ─────────────────────────
export async function generateMemberPass({ membership, restaurant, member }) {
  try {
    // Check Apple certificates exist
    const certPath = join(PASSES_DIR, 'certs')
    if (!existsSync(certPath)) {
      console.warn('Apple PassKit certificates not found. Wallet pass generation skipped.')
      console.warn('See README for PassKit setup instructions.')
      return null
    }

    const pass = await PKPass.from(
      {
        model:       join(PASSES_DIR, 'template'),
        certificates: {
          wwdr:       readFileSync(join(certPath, 'wwdr.pem')),
          signerCert: readFileSync(join(certPath, 'signerCert.pem')),
          signerKey:  readFileSync(join(certPath, 'signerKey.pem')),
          signerKeyPassphrase: process.env.PASSKIT_KEY_PASSPHRASE || '',
        },
      },
      {
        serialNumber:    membership.pass_serial,
        authenticationToken: membership.pass_auth_token,
        webServiceURL:   `${process.env.API_URL}/passes`,
        expirationDate:  membership.valid_until?.toISOString(),
      }
    )

    // Card design fields
    pass.headerFields.push({
      key:   'tier',
      value: membership.tier || 'Founding Member',
    })

    pass.primaryFields.push({
      key:   'restaurant',
      label: '',
      value: restaurant.name,
    })

    pass.secondaryFields.push(
      {
        key:   'member',
        label: 'Member',
        value: `${member.first_name} ${member.last_name}`,
      },
      {
        key:   'serial',
        label: 'Number',
        value: `№ ${String(membership.serial_number).padStart(3,'0')} / ${restaurant.membership_cap}`,
      }
    )

    pass.auxiliaryFields.push(
      {
        key:   'location',
        label: 'Location',
        value: `${restaurant.neighborhood}, ${restaurant.city}`,
      },
      {
        key:         'valid_until',
        label:       'Valid Until',
        value:       membership.valid_until
          ? new Date(membership.valid_until).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          : 'Lifetime',
        dateStyle:   'PKDateStyleMedium',
      }
    )

    // Back of the pass
    pass.backFields.push(
      { key: 'about',   label: 'About Rainback',   value: 'Your private membership for the restaurants you love.' },
      { key: 'support', label: 'Support',           value: process.env.SUPPORT_EMAIL || 'miamirainback@gmail.com' },
      { key: 'website', label: 'Website',           value: process.env.FRONTEND_URL || 'https://rainback.com' },
    )

    // Colors matching Rainback palette
    pass.backgroundColor   = 'rgb(42,31,23)'    // --ink
    pass.labelColor        = 'rgb(232,181,154)'  // --tc-soft
    pass.foregroundColor   = 'rgb(242,234,220)'  // --sand

    const buffer = pass.getAsBuffer()

    // In production: upload to Cloudflare R2 / AWS S3 / Supabase Storage
    // and return the public URL. For now we return null until storage is configured.
    // TODO: upload buffer to object storage
    // const url = await uploadToStorage(buffer, `passes/${membership.id}.pkpass`)
    // return url

    // For development: save locally
    if (process.env.NODE_ENV !== 'production') {
      const { writeFileSync } = await import('fs')
      writeFileSync(join(PASSES_DIR, `${membership.id}.pkpass`), buffer)
      return `/passes/${membership.id}.pkpass`
    }

    return null
  } catch (err) {
    console.error('PassKit generation error:', err.message)
    return null
  }
}

// ── PASS TEMPLATE (JSON definition) ─────────────────
// This defines the visual layout of the pass card
export const PASS_TEMPLATE = {
  formatVersion: 1,
  passTypeIdentifier: process.env.PASSKIT_PASS_TYPE_ID || 'pass.com.rainback.membership',
  teamIdentifier:     process.env.PASSKIT_TEAM_ID || '',
  organizationName:   'Rainback',
  description:        'Rainback Membership',
  logoText:           'Rainback',
  barcode: {
    message:         '{{pass_serial}}',
    format:          'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
  },
}
