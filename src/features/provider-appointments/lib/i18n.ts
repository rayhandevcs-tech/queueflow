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
  // The board is honest about *why* it is empty: booking is not live yet, so
  // an owner does not sit waiting for bookings that cannot arrive.
  boardNotLiveNote: {
    bn: "কাস্টমার এখনো অ্যাপয়েন্টমেন্ট নিতে পারছে না — বুকিং চালু হলে সেগুলো এখানে বসবে।",
    en: "Customers can't book yet — once booking goes live, their appointments land here.",
  },
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

  // ---- The honest state of the feature ----
  buildingTitle: { bn: "অ্যাপয়েন্টমেন্ট বুকিং তৈরি হচ্ছে", en: "Appointment booking is being built" },
  buildingBody: {
    bn: "পার্লারে লাইভ সিরিয়াল নয় — কাস্টমার তারিখ আর সময় বেছে অ্যাপয়েন্টমেন্ট নেবে। ওটা তৈরি হচ্ছে; নিচে কী কী আসছে দেখো।",
    en: "A parlour doesn't run a live line — customers will pick a date and a time slot. That's being built; here's what's coming.",
  },
  comingSlotPicker: {
    bn: "কাস্টমার তারিখ ও সময় বেছে বুক করবে",
    en: "Customers pick a date and a time slot",
  },
  comingCalendar: {
    bn: "তোমার দিনের ক্যালেন্ডার — কোন বিউটিশিয়ানের কখন কাজ",
    en: "Your day calendar — who is booked, and when",
  },
  comingHours: {
    bn: "প্রত্যেক বিউটিশিয়ানের কর্মঘণ্টা ও ছুটি",
    en: "Working hours and time off for each beautician",
  },
  comingReminder: {
    bn: "কাস্টমারকে আগের দিন মনে করিয়ে দেওয়া",
    en: "A reminder to the customer the day before",
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
