import type { Dict } from "@/lib/i18n";

export const providerAppointmentsDict = {
  // ---- Today ----
  greeting: { bn: "আজকের হিসাব", en: "Today at a glance" },
  todayDate: {
    bn: (date: string) => `আজ ${date}`,
    en: (date: string) => `Today, ${date}`,
  },
  // One `chairs` row is one seat and the beautician who works it, so counting
  // them separately would print the same number twice.
  seatsTile: { bn: "সিট ও বিউটিশিয়ান", en: "Seats & staff" },
  activeSeatsTile: { bn: "আজ চালু", en: "On today" },
  servicesTile: { bn: "সার্ভিস", en: "Services" },
  appointmentsTile: { bn: "আজকের অ্যাপয়েন্টমেন্ট", en: "Today's appointments" },

  // ---- The day board ----
  boardTitle: { bn: "আজকের সময়সূচি", en: "Today's schedule" },
  boardHours: {
    bn: (open: string, close: string) => `${open} – ${close}`,
    en: (open: string, close: string) => `${open} – ${close}`,
  },
  boardLoadFailed: {
    bn: "সময়সূচি আনা গেল না। একটু পরে আবার চেষ্টা করো।",
    en: "Couldn't load the schedule. Try again in a moment.",
  },
  boardNoStaffTitle: {
    bn: (staff: string) => `এখনো কোনো ${staff} যোগ করা হয়নি`,
    en: (staff: string) => `No ${staff.toLowerCase()} yet`,
  },
  boardNoStaffDesc: {
    bn: "সময়সূচির প্রতিটা কলাম একজন করে — অন্তত একজন যোগ করলে বোর্ড আঁকা শুরু হবে।",
    en: "Each column of the schedule is one of them — add at least one and the board starts drawing.",
  },
  boardNoStaffCta: { bn: "যোগ করো", en: "Add one" },
  boardClosedTitle: { bn: "আজ দোকান বন্ধ", en: "Closed today" },
  boardClosedDesc: {
    bn: "সাপ্তাহিক সময়সূচি অনুযায়ী আজ বন্ধ, তাই আজকের কোনো গ্রিড নেই।",
    en: "Your weekly hours say you're shut today, so there's no grid to draw.",
  },
  boardNoHoursTitle: { bn: "খোলার সময় এখনো সেট করা হয়নি", en: "Opening hours aren't set" },
  boardNoHoursDesc: {
    bn: "দিনের গ্রিড তোমার খোলা-বন্ধের সময় ধরে আঁকা হয়। সেটিংসে সময় বসালেই সময়সূচি দেখা যাবে।",
    en: "The day grid is drawn from your opening and closing times. Set them and the schedule appears.",
  },
  boardHoursCta: { bn: "সময় সেট করো", en: "Set your hours" },
  boardEmptyDay: { bn: "আজ কোনো অ্যাপয়েন্টমেন্ট নেই", en: "No appointments today" },
  boardNotLiveNote: {
    bn: "কাস্টমাররা তোমার পাতা থেকে সময় বেছে বুক করলে সেগুলো এখানেই বসবে।",
    en: "When customers pick a time on your page, their bookings appear here.",
  },
  // ---- Detail sheet ----
  detailTitle: { bn: "অ্যাপয়েন্টমেন্টের বিস্তারিত", en: "Appointment details" },
  detailWhen: { bn: "সময়", en: "When" },
  detailServices: { bn: "সার্ভিস", en: "Services" },
  detailPrice: { bn: "দাম", en: "Price" },
  detailFinished: {
    bn: "এই অ্যাপয়েন্টমেন্টটা শেষ হয়ে গেছে — আর কিছু করার নেই।",
    en: "This appointment is finished — nothing left to do.",
  },
  noCustomerName: { bn: "নাম দেওয়া হয়নি", en: "No name given" },

  nowLabel: { bn: "এখন", en: "Now" },
  runsPastClose: { bn: "বন্ধের সময় পেরিয়ে যাচ্ছে", en: "Runs past closing" },
  startsBeforeOpen: { bn: "খোলার আগে শুরু", en: "Starts before opening" },

  // ---- Appointment statuses (mirrors the planned appointment_status enum) ----
  statusBOOKED: { bn: "বুক করা", en: "Booked" },
  statusCONFIRMED: { bn: "নিশ্চিত", en: "Confirmed" },
  statusIN_PROGRESS: { bn: "চলছে", en: "In progress" },
  statusDONE: { bn: "শেষ", en: "Done" },
  statusCANCELLED: { bn: "বাতিল", en: "Cancelled" },
  statusNO_SHOW: { bn: "আসেনি", en: "No show" },

  // ---- How booking works now that it is live ----
  liveTitle: { bn: "অ্যাপয়েন্টমেন্ট বুকিং চালু", en: "Appointment booking is live" },
  liveBody: {
    bn: "কাস্টমার তোমার দোকানের পাতা থেকে সার্ভিস, দিন আর সময় বেছে বুক করতে পারছে। যে সময় ইতিমধ্যেই কারো নামে বুক, সেটা তাকে দেখানোই হবে না।",
    en: "Customers can pick a service, a day and a time on your shop page. A time that is already taken is never offered to them.",
  },
  liveSlotRule: {
    bn: "সার্ভিসের সময় ধরেই স্লট বসে — সার্ভিসের সময় বদলালে স্লটও বদলাবে",
    en: "Slot length comes from the service's duration — change one and the other follows",
  },
  liveHoursRule: {
    bn: "দোকানের সাপ্তাহিক খোলা-বন্ধের সময়ের বাইরে কেউ বুক করতে পারবে না",
    en: "Nobody can book outside your weekly opening hours",
  },
  liveStatusRule: {
    bn: "বোর্ডে অ্যাপয়েন্টমেন্টে চাপ দিয়ে নিশ্চিত, শুরু, শেষ বা বাতিল করো",
    en: "Tap an appointment on the board to confirm, start, finish or cancel it",
  },
  liveComingReminder: {
    bn: "কাস্টমারকে আগের দিন মনে করিয়ে দেওয়া — পরের ধাপে আসছে",
    en: "Reminding the customer the day before — coming next",
  },

  // ---- Quick actions ----
  setUpTitle: { bn: "এখনই যা গুছিয়ে রাখতে পারো", en: "What you can set up now" },
  setUpSeats: { bn: "সিট ও বিউটিশিয়ান যোগ করো", en: "Add seats and beauticians" },
  setUpSeatsHint: {
    bn: "অ্যাপয়েন্টমেন্ট এলে এদের নামেই স্লট বসবে।",
    en: "Slots will be booked against these when appointments arrive.",
  },
  setUpServices: { bn: "সার্ভিস ও সময় ঠিক করো", en: "Set your services and their length" },
  setUpServicesHint: {
    bn: "প্রতিটা সার্ভিসে কত সময় লাগে — সেটাই স্লটের দৈর্ঘ্য ঠিক করবে।",
    en: "How long each service takes is what will decide the slot length.",
  },
} satisfies Dict;
