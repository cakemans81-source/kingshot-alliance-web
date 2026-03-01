import type { Metadata } from "next";
import EventAttendanceClient from "./EventAttendanceClient";

export const metadata: Metadata = {
    title: "[ KDH ] 연맹 이벤트 참여 현황",
    description: "KDH 연맹 이벤트 참여 현황 - 연맹원별 출석 체크 및 관리",
};

export default function EventAttendancePage() {
    return <EventAttendanceClient />;
}
