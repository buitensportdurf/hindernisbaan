import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
import Root from './toggle-group.svelte';
import Item from './toggle-group-item.svelte';

export {
  Root,
  Item,
  //
  Root as ToggleGroup,
  Item as ToggleGroupItem
};

export type RootProps = ToggleGroupPrimitive.RootProps;
