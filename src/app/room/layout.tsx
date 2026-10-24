import { Suspense } from "react";
import RoomProvider from "@/components/RoomProvider";
import { Spinner } from "@/components/ui";

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Spinner label="ルームを読み込み中…" />}>
      <RoomProvider>{children}</RoomProvider>
    </Suspense>
  );
}
