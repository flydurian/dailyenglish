import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

const Calendar = ({ selectedDate, onDateSelect, closeCalendar, goToToday, availableDates }) => {
    const [displayDate, setDisplayDate] = useState(new Date(selectedDate));
    const calendarRef = useRef(null);

    const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const changeMonth = useCallback((offset) => {
        setDisplayDate(new Date(year, month + offset, 1));
    }, [year, month]);

    const handleDateClick = useCallback((day) => {
        const clickedDate = new Date(year, month, day);
        const dateString = clickedDate.toISOString().split('T')[0];
        
        // 데이터가 있는 날짜만 선택 가능
        if (availableDates.includes(dateString)) {
            onDateSelect(clickedDate);
            closeCalendar();
        }
    }, [onDateSelect, closeCalendar, year, month, availableDates]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target)) {
                closeCalendar();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [closeCalendar]);

    const handleGoToToday = useCallback(() => {
        goToToday();
        closeCalendar();
    }, [goToToday, closeCalendar]);

    return (
        <div className="mobile-modal bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div ref={calendarRef} className="bg-white rounded-2xl shadow-2xl mobile-spacing w-full max-w-sm animate-fade-in-up">
                <div className="flex items-center justify-between mb-3">
                    <button 
                        onClick={() => changeMonth(-1)} 
                        className="mobile-button p-3 rounded-full hover:bg-gray-100 transition-colors"
                        aria-label="이전 달"
                    >
                        <ChevronLeftIcon />
                    </button>
                    <div className="mobile-text-large font-bold text-gray-800">
                        {year}년 {month + 1}월
                    </div>
                    <button 
                        onClick={() => changeMonth(1)} 
                        className="mobile-button p-3 rounded-full hover:bg-gray-100 transition-colors"
                        aria-label="다음 달"
                    >
                        <ChevronRightIcon />
                    </button>
                </div>
                
                <div className="grid grid-cols-7 gap-2 text-center mobile-text">
                    {daysOfWeek.map(day => (
                        <div key={day} className="font-semibold text-gray-500 p-3">
                            {day}
                        </div>
                    ))}
                    {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                        <div key={`empty-${i}`}></div>
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, day) => {
                        const date = day + 1;
                        const clickedDate = new Date(year, month, date);
                        const dateString = clickedDate.toISOString().split('T')[0];
                        const hasData = availableDates.includes(dateString);
                        
                        const isSelected = date === selectedDate.getDate() && 
                                         month === selectedDate.getMonth() && 
                                         year === selectedDate.getFullYear();
                        const isToday = date === new Date().getDate() && 
                                      month === new Date().getMonth() && 
                                      year === new Date().getFullYear();
                        
                        return (
                            <button 
                                key={date} 
                                onClick={() => handleDateClick(date)} 
                                className={`mobile-button w-12 h-12 rounded-full transition-colors duration-200 flex items-center justify-center mobile-text ${
                                    isSelected 
                                        ? 'bg-indigo-600 text-white font-bold' 
                                        : isToday 
                                            ? hasData 
                                                ? 'bg-indigo-100 text-indigo-700 font-bold' 
                                                : 'bg-gray-100 text-gray-400'
                                            : hasData 
                                                ? 'hover:bg-gray-100 text-gray-800' 
                                                : 'text-gray-300 cursor-not-allowed'
                                }`}
                                disabled={!hasData}
                                aria-label={`${date}일 ${hasData ? '선택' : '데이터 없음'}`}
                                title={hasData ? `${date}일 선택` : `${date}일 - 데이터가 없습니다`}
                            >
                                {date}
                            </button>
                        );
                    })}
                </div>
                
                <button 
                    onClick={handleGoToToday} 
                    className="mobile-button w-full mt-4 bg-indigo-50 text-indigo-700 font-semibold py-3 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                    오늘로 이동
                </button>
            </div>
        </div>
    );
};

export default Calendar;
