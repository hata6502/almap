import { Photo } from "./database";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { Dispatch, FunctionComponent, SetStateAction, useState } from "react";

export const Calendar: FunctionComponent<{
  album: Photo[];
  dateRange: [Date, Date];
  setDateRange: Dispatch<SetStateAction<[Date, Date]>>;
}> = ({ album, dateRange: [start, end], setDateRange }) => {
  const [dateOfMonth, setDateOfMonth] = useState(new Date());

  const days = getDaysOfMonth(dateOfMonth);
  const heatmap = Map.groupBy(album, (photo) =>
    new Date(photo.originalDate).setHours(0, 0, 0, 0)
  );

  const handlePrevMonthButtonClick = () => {
    setDateOfMonth((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() - 1);
      return next;
    });
  };
  const handleNextMonthButtonClick = () => {
    setDateOfMonth((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() + 1);
      return next;
    });
  };

  const handleCurrentMonthButtonClick = () => {
    const input = prompt(
      "年月を入力してください",
      `${dateOfMonth.getFullYear()}/${dateOfMonth.getMonth() + 1}`
    );
    const next = input && new Date(input);
    if (!next || Number.isNaN(next.getTime())) {
      return;
    }
    setDateOfMonth(next);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex items-center justify-center p-3 text-gray-400 hover:text-gray-500"
          onClick={handlePrevMonthButtonClick}
        >
          <span className="sr-only">先月</span>
          <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          className="rounded bg-indigo-50 px-2 py-1 text-xs text-gray-900 shadow-sm hover:bg-indigo-100"
          onClick={handleCurrentMonthButtonClick}
        >
          {new Intl.DateTimeFormat([], {
            year: "numeric",
            month: "long",
          }).format(dateOfMonth)}
        </button>

        <button
          type="button"
          className="flex items-center justify-center p-3 text-gray-400 hover:text-gray-500"
          onClick={handleNextMonthButtonClick}
        >
          <span className="sr-only">翌月</span>
          <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-xs leading-6 text-gray-500">
        {days.slice(0, 7).map((day) => (
          <div key={day.toISOString()}>
            {new Intl.DateTimeFormat([], { weekday: "short" }).format(day)}
          </div>
        ))}
      </div>

      <div className="isolate mt-2 grid grid-cols-7 text-sm">
        {days.map((day, dayIndex) => {
          const currentMonth = day.getMonth() === dateOfMonth.getMonth();
          const selected =
            day.getTime() >= start.getTime() &&
            day.getTime() <= end.getTime() &&
            (start.getTime() !== -8640000000000000 ||
              end.getTime() !== 8640000000000000);
          const edge = [start.getTime(), end.getTime()].includes(day.getTime());
          const today = day.getTime() === new Date().setHours(0, 0, 0, 0);

          const background = getBackground(heatmap.get(day.getTime()) ?? []);

          const handleClick = () => {
            setDateRange(([currentStart, currentEnd]) => {
              const clickedStart = day.getTime() === currentStart.getTime();
              const clickedEnd = day.getTime() === currentEnd.getTime();
              if (clickedStart || clickedEnd) {
                return [
                  clickedStart ? new Date(-8640000000000000) : currentStart,
                  clickedEnd ? new Date(8640000000000000) : currentEnd,
                ];
              }

              if (currentStart.getTime() !== currentEnd.getTime()) {
                return [day, day];
              }

              const times = [currentStart, day].map((date) => date.getTime());
              return [
                new Date(Math.min(...times)),
                new Date(Math.max(...times)),
              ];
            });
          };

          return (
            <button
              key={day.toISOString()}
              type="button"
              className={clsx(
                "py-1.5 border-t border-gray-200 focus:z-10",
                dayIndex === days.length - 7 && "rounded-bl-md",
                dayIndex === days.length - 1 && "rounded-br-md",
                currentMonth ? "text-gray-900" : "text-gray-400",
                selected && "font-semibold",
                today && "font-bold"
              )}
              style={{ background }}
              onClick={handleClick}
            >
              <time
                dateTime={day.toISOString()}
                className={clsx(
                  "mx-auto flex h-7 w-7 items-center justify-center rounded-full",
                  selected && "bg-gray-200",
                  edge && "bg-indigo-200"
                )}
              >
                {day.getDate()}
              </time>
            </button>
          );
        })}
      </div>
    </>
  );
};

const getBackground = (heat: Photo[]) => {
  const latitude =
    heat.reduce((sum, photo) => sum + photo.latitude, 0) / heat.length -
    // 日本経緯度原点
    35.39291572;
  const longitude =
    heat.reduce((sum, photo) => sum + photo.longitude, 0) / heat.length -
    // 日本経緯度原点
    139.44288869;
  const hue =
    360 *
    ((Math.hypot(
      // 緯度1度あたりの距離
      latitude / 0.0090133729745762,
      // 経度1度あたりの距離
      longitude / 0.010966404715491394
    ) /
      // マラソンの距離
      42.195) %
      1);

  const lightness = 100 - 7.5 * Math.min(heat.length / 15, 1);
  return `hsl(${hue} 75% ${lightness}%)`;
};

const getDaysOfMonth = (dateOfMonth: Date) => {
  const days: Date[] = [];
  for (
    const day = new Date(dateOfMonth.getFullYear(), dateOfMonth.getMonth(), 1);
    day.getMonth() === dateOfMonth.getMonth();
    day.setDate(day.getDate() + 1)
  ) {
    days.push(new Date(day));
  }

  // 先月分を埋める
  while (days[0].getDay() !== 0) {
    const day = new Date(days[0]);
    day.setDate(day.getDate() - 1);
    days.unshift(day);
  }
  // 翌月分を埋める
  while (days[days.length - 1].getDay() !== 6) {
    const day = new Date(days[days.length - 1]);
    day.setDate(day.getDate() + 1);
    days.push(day);
  }

  return days;
};
