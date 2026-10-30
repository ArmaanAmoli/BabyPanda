import React from 'react';
import {breakMessageIntoLines} from '../utils/breakIntoLines';

interface VirtualizedListProps<T> {
	data: readonly T[];
	renderItem: (args: {item: T; index: number}) => React.ReactElement;
	keyExtractor: (item: T, index: number) => string;
	estimateItemHeight: (item: T, index: number) => number;
	height: number;
	width: number;
}

export function VirtualizedList<T extends object & {text: string}>({
	data,
	renderItem,
	keyExtractor,
	estimateItemHeight,
	height,
	width,
}: VirtualizedListProps<T>) {
	/*  
        Assume: estimateItemHeight manages padding and margin

        The user only give json with text:string => we adjust it

        write the logic for
            calling useScrollable()
            implimenting scrollBy() using args
            implimenting getScrollState()
            break content into lines (must manupulate generic for that)
        
        end goal
            prepare a array whose element can directly be put into renderItem()
            one by one
    */

	const renderItems: T[] = [];
	const scrollBy = (delta: number): void => {
		data.forEach((item, index) => {
			const height = estimateItemHeight(item, index);
		});
	};
	return (
		<>
			{renderItems.map((item, index) => {
				return renderItem({item, index});
			})}
		</>
	);
}
