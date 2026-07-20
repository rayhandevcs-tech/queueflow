// import Link from "next/link";

// export default function HomePage() {
//   return (
//     <main className="grid min-h-dvh place-items-center">
//       <div className="text-center">
//         {/* <h1 className="text-2xl font-bold">QueueFlow </h1> */}
//         <Link
//           href="/login"
//           className="mt-4 inline-block rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white"
//         >
//           লগইন করুন
//         </Link>
//       </div>
//     </main>
//   );
// }

import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/dashboard");
}