# Barber Shop / Salon Booking App — Complete Feature Analysis

> Source: 26-page UI design PDF (customer-facing mobile app, iOS-style, red/coral #E85B5B accent, clean white theme).
> App type: On-demand salon & barber appointment booking app (Fresha / Booksy style).

---

## 1. Authentication & Onboarding Module

### 1.1 Sign Up (Create Account)
- Fields: Name, Email, Password (show/hide toggle)
- "Agree with Terms & Condition" checkbox (link to T&C page)
- Primary CTA: **Sign Up**
- Social sign-up: Apple, Google, Facebook
- Link: "Already have an account? → Sign In"
- Flow: Sign Up → Email OTP Verification → Complete Profile → Location → Home

### 1.2 Sign In
- Fields: Email, Password (show/hide toggle)
- "Forgot Password?" link
- Primary CTA: **Sign In**
- Social sign-in: Apple, Google, Facebook
- Link: "Don't have an account? → Sign Up"

### 1.3 OTP / Verify Code
- 4-digit OTP input boxes (auto-focus advance)
- Sent to the user's email (email shown in red highlight)
- "Didn't receive OTP? → Resend code" (with cooldown timer recommended)
- CTA: **Verify**
- Used for: email verification after signup + forgot-password flow

### 1.4 Complete Your Profile
- Avatar upload (circular photo + edit/pencil badge)
- Fields: Name, Phone Number (country-code dropdown, default +1), Gender (select dropdown)
- Privacy note: "Only you can see your personal data"
- CTA: **Complete Profile**

### 1.5 Location Permission
- Illustration screen: "What is Your Location?"
- Explanation: location needed to suggest nearby services
- CTA 1: **Allow Location Access** (native GPS permission)
- CTA 2: **Enter Location Manually** (text link)

### 1.6 Enter Location Manually
- Search bar with clear (×) button
- "Use my current location" quick option
- Live search results list (place name + address) — Google Places–style autocomplete
- Selecting a result sets the user's active location

---

## 2. Home Module (Bottom Tab 1)

- **Header:** current location display ("New York, USA" + dropdown to change) + Notification bell icon (with badge)
- **Search bar:** "Search Salon, Specialist..." + Filter button (opens filter panel: category, distance, rating, price ইত্যাদি)
- **#SpecialForYou promo carousel:**
  - Swipeable banner cards with page-dots
  - "Limited time!" tag, discount text (e.g., "Get Special Discount Up to 40%")
  - **Claim** button → applies promo/coupon
  - "See All" → full offers list
- **Services (category) row:** circular icons — Haircuts, Make Up, Shaving, Massage, + more (horizontal scroll), "See All" → all categories; tap = category-filtered salon list
- **Top Rated Salons:** horizontal cards (photo, rating badge ★4.8, favorite ♥ toggle), "See All" → full list
- **Bottom Navigation (5 tabs):** Home · Explore · Bookings · Chat · Profile

---

## 3. Explore Module (Bottom Tab 2) — Map Discovery

- Full-screen map with salon location pins (each pin shows salon thumbnail)
- User's current-location marker + "re-center" button
- Search bar + Filter button (same as Home)
- **Bottom carousel of salon cards** (swipe ↔ syncs with map pins):
  - Salon photo, name, address
  - Rating (5.0 ★★★★★, 107 Reviews)
  - "Starting @ $24.00" (minimum price)
  - Distance/time: "3.5 km/50min"
  - Direction (navigate) button

---

## 4. Salon Detail Module

### 4.1 Header (common across all tabs)
- Hero/cover photo, Back button, Share button, Favorite (♥) button
- Floating rating badge: ★4.8 (1k+ Review)
- Salon name + service summary ("Haircuts, Make Up, Shaving, Massage")
- Address (map-pin icon)
- Meta line: travel time · distance · open days/hours ("15 min · 1.5km · Mon–Sun | 11am–11pm")
- **5 Quick-action buttons:** Website · Message (in-app chat) · Call · Direction (map) · Share
- Sticky bottom CTA: **Book Appointment**

### 4.2 Tabs (horizontal scrollable tab bar)
1. **Services** — service count (e.g., 18); category list rows ("Hair Cut — 20 Types >", "Hair Coloring — 12 Types >", "Hair Wash — 08 Types >") → each expands to sub-service list with prices
2. **Specialist** — staff count (18); grid of specialist cards (photo, name, role e.g. "Hair Stylist"/"Nail Artist", individual rating) → taps into Specialist Profile
3. **Package** — packages count (28); package cards: image, title, "Special Offers Package, Valid until <date>", price, **Book Now** button → Package Detail
4. **Gallery** — Photos count (8); photo grid + **add photo** (user-contributed photos)
5. **Review** — "add review" button; search-in-reviews bar; filter chips: Filter ▾ / Verified / Latest / With Photos / Detailed…; review cards: avatar, name, follower count, verified badge, star rating, time ago, review text
6. **About Us** — description with "Read more" expand; **Working Hours** table (Monday–Sunday, per-day open/close times)

---

## 5. Specialist Profile Module

- Cover photo + circular profile photo
- Name, associated salon name, rating (★4.8, 1k+ Review)
- Quick actions: **Call** + **Message** buttons (top-right)
- **Service List** (count, e.g., 28): each card = photo, service name, duration (⏱ 30 Min), price, favorite ♥, **Book Now** button
- Book Now → pre-selects this specialist in the booking flow

---

## 6. Package Detail Module

- Hero image, package name ("Haircut & Hairstyle")
- Offer validity ("Special Offers Package, valid until Aug. 25, 2024")
- Description with "Read more"
- **Included services checklist** (✓ Haircut, ✓ Hairstylist, ✓ Hair Coloring, ✓ Shave Mustache, ✓ Shave the Beard, ✓ Facial)
- CTA: **Book Appointment – $125** (price shown in button)

---

## 7. Booking Flow Module (core flow)

### 7.1 Book Appointment (bottom-sheet on salon page)
- **Day picker:** horizontal date chips ("Today 4 Oct", "Mon 5 Oct"…)
- **Time picker:** horizontal time-slot chips (7:00 PM, 7:30 PM, 8:00 PM…) — only available slots enabled
- **Specialist picker:** horizontal specialist cards with radio/check selection
- CTA: **Book Appointment** → Review Summary

### 7.2 Review Summary
- Booking info card: Barber/Salon, Address, customer Name, Phone, Booking Date, Booking Hours, Specialist
- Itemized service list with prices: e.g., Haircut (Quiff) $60.00, Hair Wash (Aloe Vera Shampoo) $80.00, Shaving (Thin Shaving) $30.00
- **Total** amount
- Selected payment method row (e.g., Cash) + **Change** link → Payment Method screen
- CTA: **Confirm Payment**

### 7.3 Payment Method
- **Pay on Cash:** Cash (radio)
- **Credit & Debit Card:** Add New Card (card form: number, expiry, CVV)
- **More Payment Options:** PayPal, Apple Pay
- Single-select radio behavior

### 7.4 Payment Successful
- Success check illustration, "Payment Successful! Your Booking has been successfully done"
- CTA 1: **View E-Receipt**
- CTA 2: **Back to home**

### 7.5 E-Receipt
- Barcode (scannable at salon — booking/Service ID encoded)
- Booking info card (same as summary: salon, address, name, phone, date, time, specialist)
- Itemized services + Total
- CTA: **Download E-Receipt** (PDF/image save)

---

## 8. Bookings Module (Bottom Tab 3)

- Header: "Bookings" + search icon
- **3 tabs:** Upcoming · Completed · Cancelled
- Booking card: date-time header ("July 10, 2024 – 10:00 AM"), salon photo, salon name, address, **Service ID** (#HR452SA54)
- Completed → **View E-Receipt** button
- Upcoming (implied) → Cancel / Reschedule / Get Direction actions
- Cancelled → cancelled history

---

## 9. Navigation / Direction Module

- **Get Direction:** map screen with route line from user's location → salon pin (salon thumbnail in pin), re-center button, CTA: **Start** (turn-by-turn)
- **You Have Arrived:** success screen — "You have arrived at the barber/salon location" + **OK** (geofence-triggered arrival detection)

---

## 10. Review & Rating Module

- **Add Review screen:** salon summary header; "Your overall rating of this product" — 5-star tap selector; "Add detailed review" textarea; **add photo** attachment; CTA: **Submit**
- Review display: rating, text, photos, verified tag, reviewer follower count, time ago
- Review search + filters (Verified / Latest / With Photos / Detailed)

---

## 11. Implied / Supporting Modules (in nav & icons, screens not in PDF — must design)

- **Chat (Bottom Tab 4):** in-app messaging with salon/specialist (Message button feeds here); conversation list + chat thread
- **Profile (Bottom Tab 5):** user profile view/edit, favorites list, payment methods, notification settings, T&C, logout ইত্যাদি
- **Notifications:** bell icon → notification list (booking confirm/reminder, offers)
- **Favorites/Wishlist:** ♥ toggles on salons & services → saved list
- **Search Results & Filter panel:** search by salon/specialist; filters — category, rating, distance, price range, sort
- **Offers/See All pages:** promo list, category list, top-rated list
- **Forgot Password flow:** email entry → OTP → new password

---

## 12. Suggested Data Models (for backend)

- **User** (name, email, phone, gender, avatar, location, auth provider)
- **Salon** (name, cover, photos, address, geo, hours per weekday, categories, rating agg, website, phone)
- **Service** (salon_id, category, name, type/variant, price, duration)
- **Specialist** (salon_id, name, role, photo, rating, services[])
- **Package** (salon_id, title, image, price, valid_until, included_services[], description)
- **Booking** (user, salon, specialist, date, time-slot, services[]/package, total, status: upcoming/completed/cancelled, service_id code, payment_method, payment_status)
- **Review** (user, salon, rating, text, photos[], verified)
- **Favorite**, **Notification**, **Message/Conversation**, **PaymentMethod (saved cards)**, **Promo/Offer**

## 13. Key User Flow (end-to-end)

Sign Up → OTP Verify → Complete Profile → Location Access → Home
→ (Search / Explore map / Category) → Salon Detail → Services/Specialist/Package select
→ Book Appointment (Day → Time → Specialist) → Review Summary → Payment Method → Confirm
→ Payment Success → E-Receipt → Bookings (Upcoming) → Get Direction → Arrived → Service done
→ Completed booking → Add Review
