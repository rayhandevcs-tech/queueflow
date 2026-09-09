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
