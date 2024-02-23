import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { FunctionComponent, useState } from "react";

export const Calendar: FunctionComponent = () => {
  const [dateOfMonth, setDateOfMonth] = useState(new Date());
  const days = getDaysOfMonth(dateOfMonth);

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
    if (!next || isNaN(next.getTime())) {
      return;
    }
    setDateOfMonth(next);
  };

  return (
    <>
      <div className="flex items-center justify-between text-gray-900">
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
          const today =
            new Date(day).setHours(0, 0, 0, 0) ===
            new Date().setHours(0, 0, 0, 0);

          return (
            <button
              key={day.toISOString()}
              type="button"
              className={clsx(
                "py-1.5 border-t border-gray-200 hover:bg-gray-100 focus:z-10",
                dayIndex % 7 > 0 && "border-l",
                dayIndex === days.length - 7 && "rounded-bl-md",
                dayIndex === days.length - 1 && "rounded-br-md",
                currentMonth
                  ? "bg-white text-gray-900"
                  : "bg-gray-50 text-gray-400",
                today && "font-semibold text-indigo-600"
              )}
            >
              <time
                dateTime={day.toISOString()}
                className="mx-auto flex h-7 w-7 items-center justify-center rounded-full"
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
