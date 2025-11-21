# Tool Management Plugin

Track and manage your CNC tool library with add/edit/delete operations.

## Features

### Core Functionality
- **Tool Library Management**: Add, edit, and delete tools from your library
- **Search**: Filter tools by T#, name, or type
- **Sort**: Sort tools by T#, name, or diameter (ascending/descending)
- **Export**: Export your entire tool library to JSON
- **Import**: Import tools from JSON file with conflict detection

### Tool Data Fields

#### Required Fields
- **Tool Number (T#)**: Unique identifier (positive integer)
- **Tool Name/Description**: Descriptive name (e.g., "1/4in Flat Endmill")
- **Tool Type**: Flat, Ball, V-bit, Drill, Chamfer, Surfacing, or Probe
- **Diameter**: Tool diameter in mm (must be > 0)

#### Optional Fields
- **Tool Length Offset (TLO)**: Z-axis offset in mm
- **Notes**: Additional information about the tool
- **SKU/Part Number**: Manufacturer part number
- **Image URL**: Link to tool image

### Data Validation
- No duplicate tool numbers allowed
- Diameter must be greater than 0
- Tool number must be a positive integer
- Tool name is required

## Usage

1. **Open Tool Table**: Click "Tool Table" in the Tools menu
2. **Add a Tool**: Click "Add Tool" button and fill in the form
3. **Edit a Tool**: Click the "Edit" button next to any tool
4. **Delete a Tool**: Click the "Delete" button (with confirmation)
5. **Search Tools**: Type in the search box to filter by T#, name, or type
6. **Sort Tools**: Use the sort dropdown to reorder the list
7. **Export**: Click "Export" to download your tool library as JSON
8. **Import**: Click "Import" to load tools from a JSON file

## Data Structure

Each tool is stored with the following structure:

```json
{
  "id": 1,
  "name": "1/4in Flat Endmill",
  "type": "flat",
  "diameter": 6.35,
  "offsets": {
    "tlo": 0.0
  },
  "metadata": {
    "notes": "",
    "image": "",
    "sku": ""
  },
  "dimensions": {
    "flute_length": null,
    "overall_length": null,
    "taper_angle": null,
    "radius": null,
    "stickout": null
  },
  "specs": {
    "material": null,
    "coating": null
  },
  "life": {
    "enabled": false,
    "total_minutes": null,
    "used_minutes": 0,
    "remaining_minutes": null,
    "usage_count": 0
  }
}
```

## Future Enhancements

The following features are planned for future releases:
- Tool life tracking
- M6 tool change integration
- Tool usage statistics
- Low tool life warnings
- Tool dimension management
- Material and coating specifications
- Tool image gallery

## Version History

### v0.1.0 - Initial Release
- Basic tool library management
- Add/Edit/Delete operations
- Search and sort functionality
- Export/Import support
- Data validation
