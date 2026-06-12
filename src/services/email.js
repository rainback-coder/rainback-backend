import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const FROM = `Rainback <${process.env.SMTP_USER}>`

// ── SEND OTP ─────────────────────────────────────────
export async function sendOTP(email, code) {
  if (!process.env.SMTP_USER) {
    console.log(`[DEV] OTP for ${email}: ${code}`)
    return
  }
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `Your Rainback code: ${code}`,
    text: `Your login code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:40px auto;padding:32px;background:#F2EADC;border-radius:12px">
        <h2 style="font-family:Georgia,serif;color:#2A1F17;margin:0 0 8px">Your code</h2>
        <p style="color:#8E7D6B;font-size:14px;margin:0 0 24px">Enter this to log in to Rainback</p>
        <div style="font-size:42px;font-weight:700;letter-spacing:12px;color:#C5572C;font-family:monospace">${code}</div>
        <p style="color:#8E7D6B;font-size:12px;margin:24px 0 0">Expires in 10 minutes. If you didn't request this, ignore it.</p>
      </div>`,
  })
}

// ── WELCOME ──────────────────────────────────────────
export async function sendWelcome(user) {
  if (!process.env.SMTP_USER) return
  await transporter.sendMail({
    from: FROM,
    to: user.email,
    subject: `Welcome to Rainback, ${user.first_name}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:32px;background:#F2EADC;border-radius:12px">
        <h1 style="font-family:Georgia,serif;color:#2A1F17;font-size:28px;margin:0 0 8px">Welcome, ${user.first_name}.</h1>
        <p style="color:#5C4A3A;font-size:15px;line-height:1.6">You're on Rainback — the private membership platform for independent restaurants.</p>
        <p style="color:#5C4A3A;font-size:15px;line-height:1.6">Discover restaurants taking members in your city, join their club, and get your named membership card in Apple Wallet.</p>
        <a href="${process.env.FRONTEND_URL}/discover" style="display:inline-block;margin-top:24px;padding:14px 28px;background:#2A1F17;color:#F2EADC;border-radius:100px;text-decoration:none;font-size:14px;font-weight:500">Discover restaurants →</a>
      </div>`,
  })
}

// ── MEMBERSHIP CONFIRMATION ──────────────────────────
export async function sendMembershipConfirmation({ user, restaurant, membership, passUrl }) {
  if (!process.env.SMTP_USER) return
  await transporter.sendMail({
    from: FROM,
    to: user.email,
    subject: `You're a member of ${restaurant.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:32px;background:#2A1F17;border-radius:12px;color:#F2EADC">
        <p style="font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.2em;color:#E8B59A;margin:0 0 16px">Rainback · Membership Confirmed</p>
        <h1 style="font-family:Georgia,serif;font-size:32px;font-weight:400;margin:0 0 4px;color:#F2EADC">${restaurant.name}</h1>
        <p style="font-family:monospace;font-size:13px;color:#E8B59A;margin:0 0 24px">${restaurant.neighborhood} · ${restaurant.city}</p>
        <div style="background:rgba(232,181,154,.1);border-radius:10px;padding:20px;margin:0 0 24px">
          <p style="margin:0 0 4px;font-size:13px;color:rgba(232,181,154,.7)">MEMBER</p>
          <p style="margin:0 0 16px;font-size:20px;font-weight:600">${user.first_name} ${user.last_name}</p>
          <p style="margin:0 0 4px;font-size:13px;color:rgba(232,181,154,.7)">MEMBERSHIP NUMBER</p>
          <p style="margin:0;font-family:monospace;font-size:22px;color:#E8B59A;font-weight:700">№ ${String(membership.serial_number).padStart(3,'0')} / ${restaurant.membership_cap}</p>
        </div>
        ${passUrl ? `<a href="${passUrl}" style="display:inline-block;margin-bottom:16px;padding:14px 28px;background:#C5572C;color:#F2EADC;border-radius:100px;text-decoration:none;font-size:14px;font-weight:500">Add to Apple Wallet</a>` : ''}
        <p style="font-size:12px;color:rgba(232,181,154,.6);margin:16px 0 0">Show this card at the door. Questions? ${process.env.SUPPORT_EMAIL || 'miamirainback@gmail.com'}</p>
      </div>`,
  })
}

// ── RESTAURANT APPLICATION RECEIVED ─────────────────
export async function sendApplicationReceived(application) {
  if (!process.env.SMTP_USER) return
  await transporter.sendMail({
    from: FROM,
    to: application.email,
    subject: `We received your Rainback application — ${application.restaurant_name}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:32px;background:#F2EADC;border-radius:12px">
        <h2 style="font-family:Georgia,serif;color:#2A1F17">Got it, ${application.first_name}.</h2>
        <p style="color:#5C4A3A;font-size:15px;line-height:1.6">We received your application for <strong>${application.restaurant_name}</strong>. We'll review it and be in touch within 24 hours.</p>
        <p style="color:#8E7D6B;font-size:13px">— Matteo, Rainback</p>
      </div>`,
  })
}

export default transporter
